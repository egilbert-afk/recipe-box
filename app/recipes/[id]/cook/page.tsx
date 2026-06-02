import { notFound } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { CookMode } from './cook-mode'

export default async function CookPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ servings?: string }>
}) {
  const { id } = await params
  const { servings: servingsParam } = await searchParams
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

  const parsed = parseInt(servingsParam ?? '', 10)
  const targetServings = Number.isFinite(parsed) && parsed >= 1 && parsed <= 20
    ? parsed
    : recipe.servings

  return (
    <CookMode
      title={recipe.title}
      recipeId={id}
      baseServings={recipe.servings}
      targetServings={targetServings}
      ingredients={ingredients ?? []}
      steps={steps ?? []}
    />
  )
}
