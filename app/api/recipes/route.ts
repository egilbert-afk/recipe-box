import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { sortTitle } from '@/lib/formatters'
import { CAPTURE_METHODS, type CreateRecipeInput, type CaptureMethod } from '@/lib/types'
import { trackEvent } from '@/lib/events'

export async function GET() {
  const serverClient = await createSupabaseServerClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) {
    return NextResponse.json({ error: 'No household found' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('recipes')
    .select('id, title, cuisine_id, meal_type_id, source_url, servings, capture_method, created_at, updated_at')
    .eq('household_id', membership.household_id)
    .eq('archived', false)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const sorted = [...(data ?? [])].sort((a, b) =>
    sortTitle(a.title).localeCompare(sortTitle(b.title))
  )

  return NextResponse.json(sorted)
}

export async function POST(request: NextRequest) {
  const serverClient = await createSupabaseServerClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) {
    return NextResponse.json({ error: 'No household found' }, { status: 404 })
  }

  let body: CreateRecipeInput

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.title?.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }
  if (body.title.trim().length > 200) {
    return NextResponse.json({ error: 'Title must be 200 characters or fewer' }, { status: 400 })
  }
  if (!body.cuisine_id) {
    return NextResponse.json({ error: 'Cuisine is required' }, { status: 400 })
  }
  if (!body.meal_type_id) {
    return NextResponse.json({ error: 'Meal type is required' }, { status: 400 })
  }
  if (!body.servings || body.servings < 1) {
    return NextResponse.json({ error: 'Servings must be at least 1' }, { status: 400 })
  }
  if (!body.ingredients?.length) {
    return NextResponse.json({ error: 'At least one ingredient is required' }, { status: 400 })
  }
  if (!body.steps?.length) {
    return NextResponse.json({ error: 'At least one step is required' }, { status: 400 })
  }
  if (body.source_url) {
    let parsedUrl: URL
    try {
      parsedUrl = new URL(body.source_url)
    } catch {
      return NextResponse.json({ error: 'source_url must be a valid URL' }, { status: 400 })
    }
    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
      return NextResponse.json({ error: 'source_url must use http or https' }, { status: 400 })
    }
    if (body.source_url.length > 2000) {
      return NextResponse.json({ error: 'source_url must be 2000 characters or fewer' }, { status: 400 })
    }
  }
  for (const ing of body.ingredients) {
    if (ing.name.length > 200) {
      return NextResponse.json({ error: 'Ingredient names must be 200 characters or fewer' }, { status: 400 })
    }
  }
  for (const step of body.steps) {
    if (step.instruction.length > 2000) {
      return NextResponse.json({ error: 'Step instructions must be 2000 characters or fewer' }, { status: 400 })
    }
  }

  const captureMethod: CaptureMethod =
    body.capture_method && CAPTURE_METHODS.includes(body.capture_method)
      ? body.capture_method
      : 'manual'

  const { data: recipe, error: recipeError } = await supabase
    .from('recipes')
    .insert({
      title: body.title.trim(),
      cuisine_id: body.cuisine_id,
      meal_type_id: body.meal_type_id,
      source_url: body.source_url || null,
      servings: body.servings,
      capture_method: captureMethod,
      household_id: membership.household_id,
      created_by: user.id,
    })
    .select()
    .single()

  if (recipeError) {
    return NextResponse.json({ error: recipeError.message }, { status: 500 })
  }

  const { error: ingredientsError } = await supabase
    .from('ingredients')
    .insert(
      body.ingredients.map((ing, i) => ({
        recipe_id: recipe.id,
        name: ing.name.trim(),
        amount: ing.amount,
        unit: ing.unit || null,
        order_index: ing.order_index ?? i,
      }))
    )

  if (ingredientsError) {
    await supabase.from('recipes').delete().eq('id', recipe.id)
    return NextResponse.json({ error: ingredientsError.message }, { status: 500 })
  }

  const { error: stepsError } = await supabase
    .from('steps')
    .insert(
      body.steps.map((step, i) => ({
        recipe_id: recipe.id,
        instruction: step.instruction.trim(),
        order_index: step.order_index ?? i,
      }))
    )

  if (stepsError) {
    await supabase.from('recipes').delete().eq('id', recipe.id)
    return NextResponse.json({ error: stepsError.message }, { status: 500 })
  }

  await trackEvent(user.id, membership.household_id, 'recipe_added', { capture_method: captureMethod })

  return NextResponse.json(recipe, { status: 201 })
}
