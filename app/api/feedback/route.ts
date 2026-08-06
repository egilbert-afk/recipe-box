import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  const serverClient = await createSupabaseServerClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { message?: string; household_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const message = typeof body.message === 'string' ? body.message.trim() : ''
  if (!message) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 })
  }
  if (message.length > 1000) {
    return NextResponse.json({ error: 'Message must be 1000 characters or fewer' }, { status: 400 })
  }

  const { error } = await supabase.from('feedback').insert({
    user_id: user.id,
    household_id: body.household_id ?? null,
    message,
  })

  if (error) {
    console.error('[POST /api/feedback] insert failed:', error)
    return NextResponse.json({ error: 'Something went wrong on our end. Email us at recipes.gilbert@gmail.com.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}
