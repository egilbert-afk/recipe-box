import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET() {
  const serverClient = await createSupabaseServerClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id, role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) {
    return NextResponse.json({ error: 'No household found' }, { status: 404 })
  }

  const { data: household, error: householdError } = await supabase
    .from('households')
    .select('id, name, plan, is_beta, invite_code')
    .eq('id', membership.household_id)
    .single()

  if (householdError || !household) {
    return NextResponse.json({ error: 'Household not found' }, { status: 404 })
  }

  const { data: members, error: membersError } = await supabase
    .from('household_members')
    .select('user_id, role, joined_at')
    .eq('household_id', membership.household_id)

  if (membersError) {
    return NextResponse.json({ error: membersError.message }, { status: 500 })
  }

  return NextResponse.json({
    ...household,
    // Only expose the invite code to the household owner.
    invite_code: membership.role === 'owner' ? household.invite_code : undefined,
    members: members ?? [],
  })
}
