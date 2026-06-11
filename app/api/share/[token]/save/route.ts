import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/supabase-server'

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
    return NextResponse.json({ error: 'Failed to save recipe' }, { status: 500 })
  }

  if (sourceIngredients?.length) {
    await serviceClient.from('ingredients').insert(
      sourceIngredients.map((ing) => ({ ...ing, recipe_id: cloned.id }))
    )
  }

  if (sourceSteps?.length) {
    await serviceClient.from('steps').insert(
      sourceSteps.map((step) => ({ ...step, recipe_id: cloned.id }))
    )
  }

  return NextResponse.json({ recipe_id: cloned.id }, { status: 201 })
}
