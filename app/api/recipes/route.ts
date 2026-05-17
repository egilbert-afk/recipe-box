import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import type { CreateRecipeInput } from '@/lib/types'

export async function GET() {
  const { data, error } = await supabase
    .from('recipes')
    .select('id, title, cuisine_id, meal_type_id, source_url, servings, capture_method, created_at, updated_at')
    .eq('archived', false)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  let body: CreateRecipeInput

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.title?.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
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

  const { data: recipe, error: recipeError } = await supabase
    .from('recipes')
    .insert({
      title: body.title.trim(),
      cuisine_id: body.cuisine_id,
      meal_type_id: body.meal_type_id,
      source_url: body.source_url || null,
      servings: body.servings,
      capture_method: 'manual',
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

  return NextResponse.json(recipe, { status: 201 })
}
