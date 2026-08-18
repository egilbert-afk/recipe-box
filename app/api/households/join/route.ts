import { NextRequest, NextResponse, after } from 'next/server'
import { supabase } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { trackEvent } from '@/lib/events'

// See the same helper in app/api/households/route.ts for why after() is used
// here instead of a plain await or fire-and-forget call.
function logHouseholdJoinFailure(userId: string, householdId: string | null, properties: Record<string, unknown>) {
  after(() =>
    trackEvent(userId, householdId, 'household_join_failed', properties).catch(err =>
      console.error('[POST /api/households/join] trackEvent failed:', err)
    )
  )
}

export async function POST(request: NextRequest) {
  const serverClient = await createSupabaseServerClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { invite_code?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.invite_code?.trim()) {
    return NextResponse.json({ error: 'Invite code is required' }, { status: 400 })
  }

  // A user may only belong to one household. A failed check must not be treated
  // the same as "no household" — see the same check in POST /api/households.
  const { data: existing, error: existingError } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existingError) {
    console.error('[POST /api/households/join] membership check failed:', existingError)
    logHouseholdJoinFailure(user.id, null, { stage: 'membership_check', error: existingError.message })
    return NextResponse.json({ error: 'Something went wrong on our end. Tell us what happened using the Feedback button.' }, { status: 500 })
  }

  if (existing) {
    return NextResponse.json({ error: 'You already belong to a household' }, { status: 409 })
  }

  const { data: household } = await supabase
    .from('households')
    .select('id, name, plan, is_beta')
    .eq('invite_code', body.invite_code.trim().toUpperCase())
    .maybeSingle()

  if (!household) {
    return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 })
  }

  const { error: memberError } = await supabase
    .from('household_members')
    .insert({ household_id: household.id, user_id: user.id, role: 'member', invited_by: null })

  if (memberError) {
    console.error('[POST /api/households/join] member insert failed:', memberError)
    logHouseholdJoinFailure(user.id, household.id, { stage: 'member_insert', error: memberError.message })

    // A unique_violation on user_id means a concurrent request already made this
    // user a member of a household (this one or another) — report it as the same
    // "already belong to a household" case, not a generic failure.
    if (memberError.code === '23505') {
      return NextResponse.json({ error: 'You already belong to a household' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Something went wrong on our end. Tell us what happened using the Feedback button.' }, { status: 500 })
  }

  await trackEvent(user.id, household.id, 'household_joined')

  return NextResponse.json(household, { status: 200 })
}
