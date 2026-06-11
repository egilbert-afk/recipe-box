import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Public endpoint — no auth required. Uses service role to bypass RLS.
const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const { data: recipe } = await serviceClient
    .from('recipes')
    .select('id, title, cuisine_id, meal_type_id, servings, source_url, notes')
    .eq('share_token', token)
    .maybeSingle()

  if (!recipe) {
    return NextResponse.json({ error: 'Recipe not found' }, { status: 404 })
  }

  const [{ data: ingredients }, { data: steps }] = await Promise.all([
    serviceClient
      .from('ingredients')
      .select('id, name, amount, unit, order_index')
      .eq('recipe_id', recipe.id)
      .order('order_index'),
    serviceClient
      .from('steps')
      .select('id, instruction, order_index')
      .eq('recipe_id', recipe.id)
      .order('order_index'),
  ])

  return NextResponse.json({
    ...recipe,
    ingredients: ingredients ?? [],
    steps: steps ?? [],
  })
}
