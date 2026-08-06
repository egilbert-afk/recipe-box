import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import type { UpdateRecipeInput } from '@/lib/types'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

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

  const { data: recipe } = await supabase
    .from('recipes')
    .select('id, archived')
    .eq('id', id)
    .eq('household_id', membership.household_id)
    .maybeSingle()

  if (!recipe) {
    return NextResponse.json({ error: 'Recipe not found' }, { status: 404 })
  }

  if (!recipe.archived) {
    return NextResponse.json({ error: 'Only archived recipes can be permanently deleted' }, { status: 409 })
  }

  const { error } = await supabase
    .from('recipes')
    .delete()
    .eq('id', id)
    .eq('household_id', membership.household_id)

  if (error) {
    console.error('[DELETE /api/recipes/[id]] delete failed:', error)
    return NextResponse.json({ error: 'Couldn\'t delete the recipe. Try again — and if you\'re still having trouble, tell us using the Feedback button.' }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

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

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Archive/restore operation
  if ('archived' in body) {
    if (typeof body.archived !== 'boolean') {
      return NextResponse.json({ error: 'archived must be a boolean' }, { status: 400 })
    }
    const archiveNote = typeof body.archive_note === 'string' ? body.archive_note : null
    if (archiveNote && archiveNote.length > 500) {
      return NextResponse.json({ error: 'Archive note must be 500 characters or fewer' }, { status: 400 })
    }
    const archive_note = body.archived ? (archiveNote?.trim() || null) : null

    const { data, error } = await supabase
      .from('recipes')
      .update({ archived: body.archived, archive_note })
      .eq('id', id)
      .eq('household_id', membership.household_id)
      .select('id, title, archived, archive_note')
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Recipe not found' }, { status: 404 })
      }
      console.error('[PATCH /api/recipes/[id]] archive update failed:', error)
      return NextResponse.json({ error: 'Couldn\'t save your changes. Try again — and if you\'re still having trouble, tell us using the Feedback button.' }, { status: 500 })
    }

    return NextResponse.json(data)
  }

  // Full recipe edit operation
  const edit = body as unknown as UpdateRecipeInput

  if (!edit.title?.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }
  if (edit.title.trim().length > 200) {
    return NextResponse.json({ error: 'Title must be 200 characters or fewer' }, { status: 400 })
  }
  if (!edit.cuisine_id) {
    return NextResponse.json({ error: 'Cuisine is required' }, { status: 400 })
  }
  if (!edit.meal_type_id) {
    return NextResponse.json({ error: 'Meal type is required' }, { status: 400 })
  }
  if (!edit.servings || edit.servings < 1) {
    return NextResponse.json({ error: 'Servings must be at least 1' }, { status: 400 })
  }
  if (edit.notes && edit.notes.length > 1000) {
    return NextResponse.json({ error: 'Notes must be 1000 characters or fewer' }, { status: 400 })
  }
  for (const ing of edit.ingredients ?? []) {
    if (ing.name.length > 200) {
      return NextResponse.json({ error: 'Ingredient names must be 200 characters or fewer' }, { status: 400 })
    }
  }
  for (const step of edit.steps ?? []) {
    if (step.instruction.length > 2000) {
      return NextResponse.json({ error: 'Step instructions must be 2000 characters or fewer' }, { status: 400 })
    }
  }

  const { data: updated, error: recipeError } = await supabase
    .from('recipes')
    .update({
      title: edit.title.trim(),
      cuisine_id: edit.cuisine_id,
      meal_type_id: edit.meal_type_id,
      servings: edit.servings,
      notes: edit.notes?.trim() || null,
    })
    .eq('id', id)
    .eq('household_id', membership.household_id)
    .select('id')
    .single()

  if (recipeError) {
    if (recipeError.code === 'PGRST116') {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 })
    }
    console.error('[PATCH /api/recipes/[id]] recipe update failed:', recipeError)
    return NextResponse.json({ error: 'Couldn\'t save your changes. Try again — and if you\'re still having trouble, tell us using the Feedback button.' }, { status: 500 })
  }

  if (!updated) {
    return NextResponse.json({ error: 'Recipe not found' }, { status: 404 })
  }

  // Replace ingredients and steps; clear microstep cache since steps changed
  const [ingredientsDelete, stepsDelete, microstepsDelete] = await Promise.all([
    supabase.from('ingredients').delete().eq('recipe_id', id),
    supabase.from('steps').delete().eq('recipe_id', id),
    supabase.from('recipe_microsteps').delete().eq('recipe_id', id),
  ])

  if (ingredientsDelete.error || stepsDelete.error) {
    console.error('[PATCH /api/recipes/[id]] delete failed:', ingredientsDelete.error ?? stepsDelete.error)
    return NextResponse.json({ error: 'Couldn\'t save your changes. Try again — and if you\'re still having trouble, tell us using the Feedback button.' }, { status: 500 })
  }
  if (microstepsDelete.error) {
    console.error('Failed to clear microstep cache:', microstepsDelete.error.message)
  }

  if (edit.ingredients?.length) {
    const { error: ingredientsError } = await supabase.from('ingredients').insert(
      edit.ingredients.map((ing, i) => ({
        recipe_id: id,
        name: ing.name.trim(),
        amount: ing.amount,
        unit: ing.unit || null,
        order_index: ing.order_index ?? i,
      }))
    )
    if (ingredientsError) {
      console.error('[PATCH /api/recipes/[id]] ingredient insert failed:', ingredientsError)
      return NextResponse.json({ error: 'Couldn\'t save your changes. Try again — and if you\'re still having trouble, tell us using the Feedback button.' }, { status: 500 })
    }
  }

  if (edit.steps?.length) {
    const { error: stepsError } = await supabase.from('steps').insert(
      edit.steps.map((step, i) => ({
        recipe_id: id,
        instruction: step.instruction.trim(),
        order_index: step.order_index ?? i,
      }))
    )
    if (stepsError) {
      console.error('[PATCH /api/recipes/[id]] step insert failed:', stepsError)
      return NextResponse.json({ error: 'Couldn\'t save your changes. Try again — and if you\'re still having trouble, tell us using the Feedback button.' }, { status: 500 })
    }
  }

  return NextResponse.json({ id })
}
