import { NextRequest, NextResponse } from 'next/server'
import { supabase as serviceClient } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { trackEvent } from '@/lib/events'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

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

  // Fetch source recipe by share token
  const { data: source } = await serviceClient
    .from('recipes')
    .select('id, title, cuisine_id, meal_type_id, servings, source_url, notes')
    .eq('share_token', token)
    .maybeSingle()

  if (!source) {
    return NextResponse.json({ error: 'Recipe not found' }, { status: 404 })
  }

  const [{ data: sourceIngredients }, { data: sourceSteps }] = await Promise.all([
    serviceClient
      .from('ingredients')
      .select('name, amount, unit, order_index')
      .eq('recipe_id', source.id)
      .order('order_index'),
    serviceClient
      .from('steps')
      .select('instruction, order_index')
      .eq('recipe_id', source.id)
      .order('order_index'),
  ])

  // Clone into the user's household — share_token is null on the clone
  const { data: cloned, error: recipeError } = await serviceClient
    .from('recipes')
    .insert({
      title: source.title,
      cuisine_id: source.cuisine_id,
      meal_type_id: source.meal_type_id,
      servings: source.servings,
      source_url: source.source_url,
      notes: source.notes,
      household_id: membership.household_id,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (recipeError || !cloned) {
    console.error('[POST /api/share/save] recipe clone failed:', recipeError)
    return NextResponse.json({ error: 'Failed to save recipe' }, { status: 500 })
  }

  // Insert ingredients and steps — if either fails, delete the orphaned recipe
  // so the user never ends up with an incomplete clone.
  if (sourceIngredients?.length) {
    const { error: ingError } = await serviceClient.from('ingredients').insert(
      sourceIngredients.map((ing) => ({ ...ing, recipe_id: cloned.id }))
    )
    if (ingError) {
      console.error('[POST /api/share/save] ingredient insert failed:', ingError)
      await serviceClient.from('recipes').delete().eq('id', cloned.id)
      return NextResponse.json({ error: 'Failed to save recipe' }, { status: 500 })
    }
  }

  if (sourceSteps?.length) {
    const { error: stepError } = await serviceClient.from('steps').insert(
      sourceSteps.map((step) => ({ ...step, recipe_id: cloned.id }))
    )
    if (stepError) {
      console.error('[POST /api/share/save] step insert failed:', stepError)
      await serviceClient.from('recipes').delete().eq('id', cloned.id)
      return NextResponse.json({ error: 'Failed to save recipe' }, { status: 500 })
    }
  }

  try {
    await trackEvent(user.id, membership.household_id, 'recipe_saved_from_share')
  } catch (err) {
    console.error('trackEvent failed for recipe_saved_from_share:', err)
  }

  return NextResponse.json({ recipe_id: cloned.id }, { status: 201 })
}
