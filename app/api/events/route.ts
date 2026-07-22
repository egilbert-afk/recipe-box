import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabase } from '@/lib/supabase'
import { VALID_EVENTS } from '@/lib/events'

export async function POST(request: NextRequest) {
  const serverClient = await createSupabaseServerClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { event_name?: string; properties?: Record<string, unknown> }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.event_name || !VALID_EVENTS.includes(body.event_name as never)) {
    return NextResponse.json({ error: 'Invalid event name' }, { status: 400 })
  }

  // Look up household server-side rather than trusting the client to send it.
  // .limit(1) prevents maybeSingle() from erroring when a user appears in multiple
  // household_members rows (possible in dev/testing; maybeSingle errors on >1 row).
  const { data: membership, error: membershipError } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (membershipError) {
    console.error('[api/events] household lookup failed:', membershipError.message)
  }

  const { error } = await supabase.from('events').insert({
    user_id: user.id,
    household_id: membership?.household_id ?? null,
    event_name: body.event_name,
    properties: body.properties ?? {},
  })

  if (error) {
    return NextResponse.json({ error: 'Something went wrong on our end. Tell us what happened using the Feedback button.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}
