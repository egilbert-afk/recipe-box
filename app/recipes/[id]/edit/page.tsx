import { notFound, redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { EditRecipeForm } from './EditRecipeForm'

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) redirect('/recipes')

  const { data: recipe, error: recipeError } = await supabase
    .from('recipes')
    .select('*')
    .eq('id', id)
    .eq('household_id', membership.household_id)
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
