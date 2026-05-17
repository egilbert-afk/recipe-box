import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Recipe } from '@/lib/types'

export const dynamic = 'force-dynamic'

const CUISINE_LABELS: Record<string, string> = {
  american: 'American / Comfort Food',
  italian: 'Italian',
  mexican: 'Mexican',
  mediterranean: 'Mediterranean',
  asian: 'Asian',
  french: 'French',
  indian: 'Indian',
  other: 'Other',
}

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: 'Breakfast',
  entree: 'Entrée',
  side: 'Side',
  dessert: 'Dessert',
  cocktail: 'Cocktail',
}

export default async function RecipesPage() {
  const { data: recipes, error } = await supabase
    .from('recipes')
    .select('id, title, cuisine_id, meal_type_id, servings, created_at')
    .eq('archived', false)
    .order('created_at', { ascending: false })

  if (error) {
    return <p className="p-4 text-red-600">Failed to load recipes: {error.message}</p>
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

      <main className="px-4 py-4">
        {recipes.length === 0 ? (
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
            {(recipes as Recipe[]).map((recipe) => (
              <li key={recipe.id}>
                <Link href={`/recipes/${recipe.id}`} className="flex flex-col py-4 gap-1">
                  <span className="text-base font-medium text-gray-900">{recipe.title}</span>
                  <span className="text-sm text-gray-500">
                    {CUISINE_LABELS[recipe.cuisine_id]} · {MEAL_TYPE_LABELS[recipe.meal_type_id]} · Serves {recipe.servings}
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
