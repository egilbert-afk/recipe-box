import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { trackEvent } from '@/lib/events'

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
    await trackEvent(user.id, null, 'household_join_failed', { stage: 'membership_check', error: existingError.message }).catch(err =>
      console.error('[POST /api/households/join] trackEvent failed:', err)
    )
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
    await trackEvent(user.id, household.id, 'household_join_failed', { stage: 'member_insert', error: memberError.message }).catch(err =>
      console.error('[POST /api/households/join] trackEvent failed:', err)
    )
    return NextResponse.json({ error: 'Something went wrong on our end. Tell us what happened using the Feedback button.' }, { status: 500 })
  }

  await trackEvent(user.id, household.id, 'household_joined')

  return NextResponse.json(household, { status: 200 })
}
