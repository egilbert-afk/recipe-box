import { NextRequest, NextResponse } from 'next/server'
import { supabase as serviceClient } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  const serverClient = await createSupabaseServerClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: membership } = await serviceClient
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) {
    return NextResponse.json({ error: 'No household found' }, { status: 403 })
  }

  let body: { recipe_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const recipeId = body.recipe_id?.trim()
  if (!recipeId) {
    return NextResponse.json({ error: 'recipe_id is required' }, { status: 400 })
  }

  const { error } = await serviceClient.from('discover_dismissals').insert({
    household_id: membership.household_id,
    recipe_id: recipeId,
  })

  // Postgres unique_violation (23505) means already dismissed — treat as success
  if (error && error.code !== '23505') {
    console.error('[discover/dismiss] insert error:', error)
    return NextResponse.json(
      { error: 'Something went wrong. Try again in a moment.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}
