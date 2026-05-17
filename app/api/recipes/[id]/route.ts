import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const { data: recipe, error: recipeError } = await supabase
    .from('recipes')
    .select('*')
    .eq('id', id)
    .single()

  if (recipeError) {
    if (recipeError.code === 'PGRST116') {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 })
    }
    return NextResponse.json({ error: recipeError.message }, { status: 500 })
  }

  const { data: ingredients, error: ingredientsError } = await supabase
    .from('ingredients')
    .select('*')
    .eq('recipe_id', id)
    .order('order_index')

  if (ingredientsError) {
    return NextResponse.json({ error: ingredientsError.message }, { status: 500 })
  }

  const { data: steps, error: stepsError } = await supabase
    .from('steps')
    .select('*')
    .eq('recipe_id', id)
    .order('order_index')

  if (stepsError) {
    return NextResponse.json({ error: stepsError.message }, { status: 500 })
  }

  return NextResponse.json({ ...recipe, ingredients, steps })
}
