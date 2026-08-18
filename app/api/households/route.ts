import { NextRequest, NextResponse, after } from 'next/server'
import { supabase } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { trackEvent } from '@/lib/events'

// Logs an onboarding failure without adding latency to the error response.
// `after()` runs once the response has been sent, but the platform keeps the
// function alive until it finishes — unlike plain fire-and-forget, the write
// isn't at risk of being dropped when the function freezes right after return.
function logHouseholdCreationFailure(userId: string, properties: Record<string, unknown>) {
  after(() =>
    trackEvent(userId, null, 'household_creation_failed', properties).catch(err =>
      console.error('[POST /api/households] trackEvent failed:', err)
    )
  )
}

export async function POST(request: NextRequest) {
  const serverClient = await createSupabaseServerClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { name?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'Household name is required' }, { status: 400 })
  }
  if (body.name.trim().length > 100) {
    return NextResponse.json({ error: 'Household name must be 100 characters or fewer' }, { status: 400 })
  }

  // A user may only belong to one household. A failed check must not be treated
  // the same as "no household" — that silently lets a broken account keep
  // retrying and creating orphaned rows instead of surfacing the failure.
  const { data: existing, error: existingError } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existingError) {
    console.error('[POST /api/households] membership check failed:', existingError)
    logHouseholdCreationFailure(user.id, { stage: 'membership_check', error: existingError.message })
    return NextResponse.json({ error: 'Something went wrong on our end. Tell us what happened using the Feedback button.' }, { status: 500 })
  }

  if (existing) {
    return NextResponse.json({ error: 'You already belong to a household' }, { status: 409 })
  }

  const { data: household, error: householdError } = await supabase
    .from('households')
    .insert({ name: body.name.trim(), is_beta: false })
    .select()
    .single()

  if (householdError) {
    console.error('[POST /api/households] household insert failed:', householdError)
    logHouseholdCreationFailure(user.id, { stage: 'household_insert', error: householdError.message })
    return NextResponse.json({ error: 'Something went wrong on our end. Tell us what happened using the Feedback button.' }, { status: 500 })
  }

  const { error: memberError } = await supabase
    .from('household_members')
    .insert({ household_id: household.id, user_id: user.id, role: 'owner' })

  if (memberError) {
    console.error('[POST /api/households] member insert failed:', memberError)
    const { error: rollbackError } = await supabase.from('households').delete().eq('id', household.id)
    if (rollbackError) {
      console.error('[POST /api/households] rollback delete also failed — orphaned household:', household.id, rollbackError)
    }
    logHouseholdCreationFailure(user.id, {
      stage: 'member_insert',
      error: memberError.message,
      rollback_failed: !!rollbackError,
      household_id: household.id,
    })

    // A unique_violation on user_id means a concurrent request already made this
    // user a member of another household — the race the DB constraint exists to
    // catch. Report it as the same "already belong to a household" case, not a
    // generic failure.
    if (memberError.code === '23505') {
      return NextResponse.json({ error: 'You already belong to a household' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Something went wrong on our end. Tell us what happened using the Feedback button.' }, { status: 500 })
  }

  try {
    await trackEvent(user.id, household.id, 'household_created')
  } catch (err) {
    console.error('trackEvent failed after household creation:', err)
  }

  return NextResponse.json(household, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const serverClient = await createSupabaseServerClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { name?: string; discover_opt_out?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // ── discover_opt_out — any member can toggle ──────────────────────────────
  if (body.discover_opt_out !== undefined) {
    if (body.name !== undefined) {
      return NextResponse.json(
        { error: 'Send discover_opt_out and name in separate requests' },
        { status: 400 }
      )
    }
    if (typeof body.discover_opt_out !== 'boolean') {
      return NextResponse.json({ error: 'discover_opt_out must be a boolean' }, { status: 400 })
    }

    const { data: membership } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: 'No kitchen found' }, { status: 404 })
    }

    const { error } = await supabase
      .from('households')
      .update({ discover_opt_out: body.discover_opt_out })
      .eq('id', membership.household_id)

    if (error) {
      return NextResponse.json(
        { error: 'Couldn\'t update your Discover setting. Try again in a moment.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  }

  // ── name — owner only ─────────────────────────────────────────────────────
  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'Kitchen name is required' }, { status: 400 })
  }
  if (body.name.trim().length > 100) {
    return NextResponse.json({ error: 'Kitchen name must be 100 characters or fewer' }, { status: 400 })
  }

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id, role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) {
    return NextResponse.json({ error: 'No kitchen found' }, { status: 404 })
  }
  if (membership.role !== 'owner') {
    return NextResponse.json({ error: 'Only the kitchen owner can rename it' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('households')
    .update({ name: body.name.trim() })
    .eq('id', membership.household_id)
    .select('id, name')
    .single()

  if (error) {
    console.error('[PATCH /api/households] rename failed:', error)
    return NextResponse.json({ error: 'Couldn\'t rename your kitchen. Try again. If you\'re still having trouble, use the Feedback button.' }, { status: 500 })
  }

  return NextResponse.json(data)
}
