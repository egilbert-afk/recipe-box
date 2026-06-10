import { notFound } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { EditRecipeForm } from './EditRecipeForm'

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()

  const { data: recipe, error: recipeError } = await supabase
    .from('recipes')
    .select('*')
    .eq('id', id)
    .single()

  if (recipeError || !recipe) {
    notFound()
  }

  const [{ data: ingredients }, { data: steps }] = await Promise.all([
    supabase.from('ingredients').select('*').eq('recipe_id', id).order('order_index'),
    supabase.from('steps').select('*').eq('recipe_id', id).order('order_index'),
  ])

  return (
    <EditRecipeForm
      recipe={recipe}
      ingredients={ingredients ?? []}
      steps={steps ?? []}
    />
  )
}
