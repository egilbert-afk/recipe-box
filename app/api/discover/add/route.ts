import { NextRequest, NextResponse } from 'next/server'
import { supabase as serviceClient } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { trackEvent } from '@/lib/events'

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

  // Rate limit: 20 discover clones per hour per household
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count: recentCount } = await serviceClient
    .from('recipes')
    .select('*', { count: 'exact', head: true })
    .eq('household_id', membership.household_id)
    .eq('capture_method', 'discover')
    .gte('created_at', oneHourAgo)

  if ((recentCount ?? 0) >= 20) {
    return NextResponse.json(
      { error: "You've added a lot of recipes recently. Wait a bit before adding more." },
      { status: 429 }
    )
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

  // Verify source recipe is still in the pool before cloning
  const { data: source } = await serviceClient
    .from('recipes')
    .select('id, title, cuisine_id, meal_type_id, servings, source_url, notes')
    .eq('id', recipeId)
    .eq('is_discoverable', true)
    .eq('archived', false)
    .maybeSingle()

  if (!source || !source.source_url) {
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

  const { data: cloned, error: recipeError } = await serviceClient
    .from('recipes')
    .insert({
      title: source.title,
      cuisine_id: source.cuisine_id,
      meal_type_id: source.meal_type_id,
      servings: source.servings,
      source_url: source.source_url,
      is_discoverable: false,
      notes: source.notes,
      capture_method: 'discover',
      household_id: membership.household_id,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (recipeError || !cloned) {
    return NextResponse.json(
      { error: "Couldn't save your recipe. Try again — and if you're still having trouble, tell us using the Feedback button." },
      { status: 500 }
    )
  }

  if (sourceIngredients?.length) {
    const { error: ingError } = await serviceClient.from('ingredients').insert(
      sourceIngredients.map((ing) => ({ ...ing, recipe_id: cloned.id }))
    )
    if (ingError) {
      await serviceClient.from('recipes').delete().eq('id', cloned.id)
      return NextResponse.json(
        { error: "Couldn't save your recipe. Try again — and if you're still having trouble, tell us using the Feedback button." },
        { status: 500 }
      )
    }
  }

  if (sourceSteps?.length) {
    const { error: stepError } = await serviceClient.from('steps').insert(
      sourceSteps.map((step) => ({ ...step, recipe_id: cloned.id }))
    )
    if (stepError) {
      await serviceClient.from('recipes').delete().eq('id', cloned.id)
      return NextResponse.json(
        { error: "Couldn't save your recipe. Try again — and if you're still having trouble, tell us using the Feedback button." },
        { status: 500 }
      )
    }
  }

  trackEvent(user.id, membership.household_id, 'recipe_added', { capture_method: 'discover' }).catch(
    (err) => console.error('[discover/add] trackEvent failed:', err)
  )

  return NextResponse.json({ recipe_id: cloned.id }, { status: 201 })
}
