import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabase as serviceClient } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { CUISINE_LABEL, MEAL_TYPE_LABEL } from '@/lib/constants'
import { formatIngredient } from '@/lib/formatters'
import { toFraction } from '@/lib/scaler'
import { SaveRecipeButton } from './SaveRecipeButton'
import type { CuisineId, MealTypeId } from '@/lib/types'

type Ingredient = { id: string; name: string; amount: number | null; unit: string | null; order_index: number }
type Step = { id: string; instruction: string; order_index: number }

export default async function SharedRecipePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const { data: recipe } = await serviceClient
    .from('recipes')
    .select('id, title, cuisine_id, meal_type_id, servings, source_url, notes')
    .eq('share_token', token)
    .maybeSingle()

  if (!recipe) notFound()

  const [{ data: ingredients }, { data: steps }] = await Promise.all([
    serviceClient.from('ingredients').select('id, name, amount, unit, order_index').eq('recipe_id', recipe.id).order('order_index'),
    serviceClient.from('steps').select('id, instruction, order_index').eq('recipe_id', recipe.id).order('order_index'),
  ])

  // Check if the visitor is logged in and already has this recipe
  const serverClient = await createSupabaseServerClient()
  const { data: { user } } = await serverClient.auth.getUser()

  let alreadySaved = false
  if (user) {
    const { data: membership } = await serviceClient
      .from('household_members')
      .select('household_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (membership) {
      const { data: existing } = await serviceClient
        .from('recipes')
        .select('id')
        .eq('household_id', membership.household_id)
        .eq('title', recipe.title)
        .maybeSingle()
      alreadySaved = !!existing
    }
  }

  return (
    <div className="min-h-screen bg-white pb-20">
      <div className="max-w-lg mx-auto">

        <header className="px-4 py-6 border-b border-gray-200">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Shared recipe</p>
          <h1 className="text-2xl font-semibold">{recipe.title}</h1>
        </header>

        <main className="px-4 py-6 space-y-8">
          <div className="flex gap-2 flex-wrap">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-700">
              {CUISINE_LABEL[recipe.cuisine_id as CuisineId]}
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-700">
              {MEAL_TYPE_LABEL[recipe.meal_type_id as MealTypeId]}
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-700">
              Serves {recipe.servings}
            </span>
          </div>

          {recipe.source_url && /^https?:\/\//i.test(recipe.source_url) && (
            <a href={recipe.source_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 underline">
              View original source
            </a>
          )}

          <section>
            <h2 className="text-base font-semibold mb-3">Ingredients</h2>
            <ul className="space-y-2">
              {(ingredients ?? []).map((ing: Ingredient) => (
                <li key={ing.id} className="text-base text-gray-800">
                  {formatIngredient(ing.name, ing.amount !== null ? toFraction(ing.amount) : '', ing.unit)}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">Steps</h2>
            <ol className="space-y-4">
              {(steps ?? []).map((step: Step, i: number) => (
                <li key={step.id} className="flex gap-3">
                  <span className="flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-full bg-black text-white text-sm font-medium">
                    {i + 1}
                  </span>
                  <p className="text-base text-gray-800 pt-0.5">{step.instruction}</p>
                </li>
              ))}
            </ol>
          </section>

          <div className="pt-4 border-t border-gray-100">
            {alreadySaved ? (
              <p className="text-sm text-gray-500 text-center">This recipe is already in your kitchen.</p>
            ) : user ? (
              <SaveRecipeButton token={token} />
            ) : (
              <div className="space-y-3 text-center">
                <p className="text-sm text-gray-500">Save this recipe to your kitchen on Recipe Box.</p>
                <Link
                  href={`/signup?save=${token}`}
                  className="block w-full h-12 rounded-full bg-black text-white text-sm font-medium flex items-center justify-center"
                >
                  Save to Recipe Box
                </Link>
                <p className="text-sm text-gray-500">
                  Already have an account?{' '}
                  <Link href={`/login?save=${token}`} className="text-gray-900 underline">Sign in</Link>
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
