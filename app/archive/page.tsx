import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { CUISINE_LABEL, MEAL_TYPE_LABEL } from '@/lib/constants'
import { ArchiveButton } from '@/components/ArchiveButton'
import type { CuisineId, MealTypeId } from '@/lib/types'

type ArchivedRecipe = {
  id: string
  title: string
  cuisine_id: CuisineId
  meal_type_id: MealTypeId
  servings: number
  archive_note: string | null
}

export const dynamic = 'force-dynamic'

export default async function ArchivePage() {
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from('recipes')
    .select('id, title, cuisine_id, meal_type_id, servings, archive_note')
    .eq('archived', true)
    .order('updated_at', { ascending: false })

  if (error) {
    return <p className="p-4 text-red-600">Couldn't load your archive. Try refreshing the page.</p>
  }

  const recipes: ArchivedRecipe[] = data ?? []

  return (
    <div className="min-h-screen bg-white pb-20">
      <header className="flex items-center gap-3 px-4 py-4 border-b border-gray-200">
        <Link
          href="/recipes"
          className="flex items-center justify-center h-12 w-12 rounded-full text-gray-600 hover:bg-gray-100"
        >
          ←
        </Link>
        <h1 className="text-xl font-semibold flex-1">Archived Recipes</h1>
      </header>

      <main className="px-4 py-4">
        {recipes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-gray-500 text-lg">No archived recipes.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {recipes.map((recipe) => (
              <li key={recipe.id} className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-1">
                    <Link
                      href={`/recipes/${recipe.id}`}
                      className="text-base font-medium text-gray-900"
                    >
                      {recipe.title}
                    </Link>
                    <p className="text-sm text-gray-500">
                      {CUISINE_LABEL[recipe.cuisine_id]} · {MEAL_TYPE_LABEL[recipe.meal_type_id]} · Serves {recipe.servings}
                    </p>
                    {recipe.archive_note && (
                      <p className="text-sm text-gray-400 italic">"{recipe.archive_note}"</p>
                    )}
                  </div>
                  <ArchiveButton recipeId={recipe.id} archived={true} redirectAfter="/archive" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
