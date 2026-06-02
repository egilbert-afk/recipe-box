import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { CUISINE_LABEL, MEAL_TYPE_LABEL } from '@/lib/constants'
import { sortTitle } from '@/lib/formatters'
import { parseSearchQuery } from '@/lib/search'
import type { CuisineId, MealTypeId } from '@/lib/types'

type RecipeListItem = {
  id: string
  title: string
  cuisine_id: CuisineId
  meal_type_id: MealTypeId
  servings: number
}

export const dynamic = 'force-dynamic'

export default async function RecipesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const query = q?.trim() ?? ''
  const tsquery = query ? parseSearchQuery(query) : ''

  const supabase = await createSupabaseServerClient()
  let recipes: RecipeListItem[] = []
  let loadError = ''

  if (query && tsquery) {
    const { data, error } = await supabase.rpc('search_recipes_by_ingredient', { query: tsquery })
    if (error) loadError = error.message
    else recipes = data ?? []
  } else if (!query) {
    const { data, error } = await supabase
      .from('recipes')
      .select('id, title, cuisine_id, meal_type_id, servings, created_at')
      .eq('archived', false)
    if (error) loadError = error.message
    else recipes = [...(data ?? [])].sort((a, b) => sortTitle(a.title).localeCompare(sortTitle(b.title)))
  }
  // query exists but tsquery is empty (all stopwords) → recipes stays []

  if (loadError) {
    return <p className="p-4 text-red-600">Failed to load recipes: {loadError}</p>
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
        <h1 className="text-xl font-semibold">Recipe Box</h1>
        <Link
          href="/add"
          className="flex items-center justify-center h-12 px-5 rounded-full bg-black text-white text-sm font-medium"
        >
          Add Recipe
        </Link>
      </header>

      <main className="px-4 py-4 space-y-4">
        {/* Search form */}
        <form action="/recipes" method="GET" className="flex gap-2">
          <input
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Search by ingredient..."
            className="flex-1 h-12 px-4 border border-gray-300 rounded-full text-base"
          />
          <button
            type="submit"
            className="h-12 px-5 rounded-full bg-black text-white text-sm font-medium"
          >
            Search
          </button>
        </form>

        {/* Active search context */}
        {query && (
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>
              {recipes.length === 0
                ? `No results for "${query}"`
                : `${recipes.length} recipe${recipes.length === 1 ? '' : 's'} with "${query}"`}
            </span>
            <Link href="/recipes" className="text-black underline underline-offset-2">
              Clear
            </Link>
          </div>
        )}

        {/* Recipe list */}
        {!query && recipes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-gray-500 text-lg mb-6">No recipes yet.</p>
            <Link
              href="/add"
              className="flex items-center justify-center h-12 px-6 rounded-full bg-black text-white text-sm font-medium"
            >
              Add your first recipe
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {recipes.map((recipe) => (
              <li key={recipe.id}>
                <Link href={`/recipes/${recipe.id}`} className="flex flex-col py-4 gap-1">
                  <span className="text-base font-medium text-gray-900">{recipe.title}</span>
                  <span className="text-sm text-gray-500">
                    {CUISINE_LABEL[recipe.cuisine_id]} · {MEAL_TYPE_LABEL[recipe.meal_type_id]} · Serves {recipe.servings}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
