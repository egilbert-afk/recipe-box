import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabase } from '@/lib/supabase'
import { trackEvent } from '@/lib/events'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const serverClient = await createSupabaseServerClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify the recipe belongs to the user's household
  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) {
    return NextResponse.json({ error: 'No household found' }, { status: 403 })
  }

  const { data: recipe } = await supabase
    .from('recipes')
    .select('id, share_token')
    .eq('id', id)
    .eq('household_id', membership.household_id)
    .maybeSingle()

  if (!recipe) {
    return NextResponse.json({ error: 'Recipe not found' }, { status: 404 })
  }

  // Return existing token if already set (idempotent)
  if (recipe.share_token) {
    return NextResponse.json({ share_token: recipe.share_token }, { status: 200 })
  }

  // Generate a new share token
  const { data: updated, error } = await supabase
    .from('recipes')
    .update({ share_token: crypto.randomUUID() })
    .eq('id', id)
    .select('share_token')
    .single()

  if (error || !updated) {
    return NextResponse.json({ error: 'Failed to generate share link' }, { status: 500 })
  }

  await trackEvent(user.id, membership.household_id, 'recipe_shared')

  return NextResponse.json({ share_token: updated.share_token }, { status: 200 })
}
