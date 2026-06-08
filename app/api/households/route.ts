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

  // A user may only belong to one household.
  const { data: existing } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'You already belong to a household' }, { status: 409 })
  }

  const { data: household, error: householdError } = await supabase
    .from('households')
    .insert({ name: body.name.trim(), is_beta: false })
    .select()
    .single()

  if (householdError) {
    return NextResponse.json({ error: householdError.message }, { status: 500 })
  }

  const { error: memberError } = await supabase
    .from('household_members')
    .insert({ household_id: household.id, user_id: user.id, role: 'owner' })

  if (memberError) {
    await supabase.from('households').delete().eq('id', household.id)
    return NextResponse.json({ error: memberError.message }, { status: 500 })
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

  let body: { name?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

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
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
