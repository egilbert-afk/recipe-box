import { NextRequest, NextResponse } from 'next/server'
import { supabase as serviceClient } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import type { CuisineId, MealTypeId } from '@/lib/types'

export async function GET(request: NextRequest) {
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

  const { searchParams } = new URL(request.url)
  const cuisineId = searchParams.get('cuisine_id') || null
  const mealTypeId = searchParams.get('meal_type_id') || null

  const { data: rows, error } = await serviceClient.rpc('discover_next_recipe', {
    p_household_id: membership.household_id,
    p_cuisine_id: cuisineId,
    p_meal_type_id: mealTypeId,
  })

  if (error) {
    console.error('[discover] RPC error:', error)
    return NextResponse.json(
      { error: 'Something went wrong on our end. Try again in a moment.' },
      { status: 500 }
    )
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({ empty: true })
  }

  const recipe = rows[0]

  const [{ data: ingredients }, { data: steps }] = await Promise.all([
    serviceClient
      .from('ingredients')
      .select('name, amount, unit, order_index')
      .eq('recipe_id', recipe.id)
      .order('order_index'),
    serviceClient
      .from('steps')
      .select('instruction, order_index')
      .eq('recipe_id', recipe.id)
      .order('order_index'),
  ])

  return NextResponse.json({
    card: {
      id: recipe.id,
      title: recipe.title,
      source_url: recipe.source_url,
      cuisine_id: recipe.cuisine_id as CuisineId,
      meal_type_id: recipe.meal_type_id as MealTypeId,
      servings: recipe.servings,
      ingredients: ingredients ?? [],
      steps: steps ?? [],
    },
  })
}
