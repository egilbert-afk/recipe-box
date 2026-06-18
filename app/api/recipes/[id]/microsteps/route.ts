import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { generateMicrosteps } from '@/lib/claude'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const serverClient = await createSupabaseServerClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) return NextResponse.json({ error: 'No household found' }, { status: 403 })

  let body: { servings?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const servings = body.servings
  if (typeof servings !== 'number' || !Number.isInteger(servings) || servings < 1 || servings > 20) {
    return NextResponse.json({ error: 'servings must be an integer between 1 and 20' }, { status: 400 })
  }

  // Verify ownership before any cache access — prevents cross-household reads
  const { data: recipe } = await supabase
    .from('recipes')
    .select('id, servings')
    .eq('id', id)
    .eq('household_id', membership.household_id)
    .maybeSingle()

  if (!recipe) return NextResponse.json({ error: 'Recipe not found' }, { status: 404 })
  if (!recipe.servings) return NextResponse.json({ error: 'Recipe has no base serving count' }, { status: 422 })

  // Microsteps are gated to a single beta user while validating decomposition quality
  const betaUserId = process.env.MICROSTEPS_BETA_USER_ID
  if (betaUserId && user.id !== betaUserId) {
    return NextResponse.json({ gated: true })
  }

  // Return cached microsteps if available for this recipe+servings combination
  const { data: cached } = await supabase
    .from('recipe_microsteps')
    .select('steps')
    .eq('recipe_id', id)
    .eq('servings', servings)
    .maybeSingle()

  if (cached) {
    return NextResponse.json({ steps: cached.steps })
  }

  const [{ data: steps }, { data: ingredients }] = await Promise.all([
    supabase.from('steps').select('instruction, order_index').eq('recipe_id', id).order('order_index'),
    supabase.from('ingredients').select('name, amount, unit').eq('recipe_id', id).order('order_index'),
  ])

  if (!steps?.length) {
    return NextResponse.json({ error: 'Recipe has no steps' }, { status: 422 })
  }

  let microsteps: string[]
  try {
    microsteps = await generateMicrosteps(steps, ingredients ?? [], recipe.servings, servings)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to generate microsteps' },
      { status: 422 }
    )
  }

  // Cache for future cooks at this serving count (upsert handles the rare race condition)
  const { error: upsertError } = await supabase
    .from('recipe_microsteps')
    .upsert({ recipe_id: id, servings, steps: microsteps }, { onConflict: 'recipe_id,servings' })

  if (upsertError) {
    console.error('Failed to cache microsteps:', upsertError.message)
  }

  return NextResponse.json({ steps: microsteps })
}
