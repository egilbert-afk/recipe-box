import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { supabase } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function POST() {
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

  if (membership.role !== 'owner') {
    return NextResponse.json({ error: 'Only the household owner can regenerate the invite code' }, { status: 403 })
  }

  // 8 uppercase hex characters — matches the SQL default format.
  const newCode = randomBytes(4).toString('hex').toUpperCase()

  const { error } = await supabase
    .from('households')
    .update({ invite_code: newCode })
    .eq('id', membership.household_id)

  if (error) {
    console.error('[POST /api/households/invite] update failed:', error)
    return NextResponse.json({ error: 'Couldn\'t regenerate the invite code. Try again. If you\'re still having trouble, use the Feedback button.' }, { status: 500 })
  }

  return NextResponse.json({ invite_code: newCode })
}
