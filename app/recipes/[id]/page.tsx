import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Pencil } from 'lucide-react'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { CUISINE_LABEL, MEAL_TYPE_LABEL } from '@/lib/constants'
import type { RecipeWithDetails } from '@/lib/types'
import { formatIngredient } from '@/lib/formatters'
import { ServingsPicker } from '@/components/ServingsPicker'
import { ArchiveButton } from '@/components/ArchiveButton'
import { RecipeNotes } from '@/components/RecipeNotes'

export default async function RecipePage({
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

  const full: RecipeWithDetails = {
    ...recipe,
    ingredients: ingredients ?? [],
    steps: steps ?? [],
  }

  return (
    <div className="min-h-screen bg-white pb-20">
      <header className="flex items-center gap-3 px-4 py-4 border-b border-gray-200">
        <Link href="/recipes" className="flex items-center justify-center h-12 w-12 rounded-full text-gray-600 hover:bg-gray-100">
          ←
        </Link>
        <h1 className="text-lg font-semibold flex-1 truncate">{full.title}</h1>
        <Link
          href={`/recipes/${full.id}/edit`}
          className="flex items-center justify-center h-12 w-12 rounded-full text-gray-500 hover:bg-gray-100"
          aria-label="Edit recipe"
        >
          <Pencil size={20} />
        </Link>
      </header>

      <main className="px-4 py-6 space-y-8">
        <div className="flex gap-2 flex-wrap">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-700">
            {CUISINE_LABEL[full.cuisine_id]}
          </span>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-700">
            {MEAL_TYPE_LABEL[full.meal_type_id]}
          </span>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-700">
            Serves {full.servings}
          </span>
        </div>

        <ServingsPicker recipeId={full.id} baseServings={full.servings} />

        {full.notes && <RecipeNotes notes={full.notes} />}

        {full.source_url && (
          <a
            href={full.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 underline"
          >
            View original source
          </a>
        )}

        <section>
          <h2 className="text-base font-semibold mb-3">Ingredients</h2>
          <ul className="space-y-2">
            {full.ingredients.map((ing) => (
              <li key={ing.id} className="text-base text-gray-800">
                {formatIngredient(
                  ing.name,
                  ing.amount !== null ? String(ing.amount) : '',
                  ing.unit
                )}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-3">Steps</h2>
          <ol className="space-y-4">
            {full.steps.map((step, i) => (
              <li key={step.id} className="flex gap-3">
                <span className="flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-full bg-black text-white text-sm font-medium">
                  {i + 1}
                </span>
                <p className="text-base text-gray-800 pt-0.5">{step.instruction}</p>
              </li>
            ))}
          </ol>
        </section>

        <ArchiveButton recipeId={full.id} archived={full.archived} />
      </main>
    </div>
  )
}
