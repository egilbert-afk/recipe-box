import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { SignOutButton } from '@/components/SignOutButton'
import { CUISINE_LABEL, MEAL_TYPE_LABEL, MEAL_TYPES } from '@/lib/constants'
import { sortTitle } from '@/lib/formatters'
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
  searchParams: Promise<{ type?: string }>
}) {
  const { type } = await searchParams
  const activeType = MEAL_TYPES.find((m) => m.id === type)?.id ?? null

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id, households(name)')
    .eq('user_id', user!.id)
    .maybeSingle()

  const householdName = membership
    ? (membership.households as unknown as { name: string } | null)?.name ?? null
    : null

  let recipes: RecipeListItem[] = []
  let loadError = ''

  if (membership) {
    let query = supabase
      .from('recipes')
      .select('id, title, cuisine_id, meal_type_id, servings')
      .eq('archived', false)
      .eq('household_id', membership.household_id)
    if (activeType) query = query.eq('meal_type_id', activeType)
    const { data, error } = await query
    if (error) loadError = error.message
    else recipes = [...(data ?? [])].sort((a, b) => sortTitle(a.title).localeCompare(sortTitle(b.title)))
  }

  if (loadError) {
    return <p className="p-4 text-red-600">Failed to load recipes: {loadError}</p>
  }

  return (
    <div className="min-h-screen bg-white pb-20">
      <header className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-semibold">Recipe Box</h1>
          {householdName && (
            <p className="text-xs text-gray-400">{householdName}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {user?.email === process.env.ADMIN_EMAIL && (
            <Link href="/admin" className="text-sm text-gray-500 underline">
              Admin
            </Link>
          )}
          <Link href="/settings" className="text-sm text-gray-500 underline">
            Settings
          </Link>
          <SignOutButton />
        </div>
      </header>

      <main className="px-4 py-4 space-y-4">
        {/* Meal type filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
          {[{ id: null, label: 'All' }, ...MEAL_TYPES].map((m) => {
            const isActive = m.id === activeType
            return (
              <Link
                key={m.id ?? 'all'}
                href={m.id ? `/recipes?type=${m.id}` : '/recipes'}
                className={`flex-shrink-0 h-9 px-4 rounded-full text-sm font-medium flex items-center ${
                  isActive
                    ? 'bg-black text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {m.label}
              </Link>
            )
          })}
        </div>

        {/* Recipe list */}
        {recipes.length === 0 ? (
          <div className="py-12 text-center">
            {activeType ? (
              <p className="text-gray-500 text-base">No {MEAL_TYPE_LABEL[activeType]} recipes yet.</p>
            ) : (
              <>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Everything in its place.</h2>
                <p className="text-gray-500 text-sm mb-8">Start by adding your first recipe.</p>
                <div className="space-y-3 text-left">
                  {[
                    { label: 'Paste a link', description: 'From any recipe website', mode: 'url' },
                    { label: 'Take a photo', description: 'Recipe cards, cookbooks, handwritten notes', mode: 'photo' },
                    { label: 'Paste text', description: 'A message, an email, anything copied', mode: 'text' },
                  ].map((method) => (
                    <Link
                      key={method.label}
                      href={`/add?mode=${method.mode}`}
                      className="flex items-center justify-between px-4 py-4 border border-gray-200 rounded-xl"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">{method.label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{method.description}</p>
                      </div>
                      <span className="text-gray-400 text-sm">→</span>
                    </Link>
                  ))}
                </div>
              </>
            )}
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
