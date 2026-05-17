import type { CuisineId, MealTypeId } from '@/lib/types'

export const CUISINES: { id: CuisineId; label: string }[] = [
  { id: 'american', label: 'American / Comfort Food' },
  { id: 'italian', label: 'Italian' },
  { id: 'mexican', label: 'Mexican' },
  { id: 'mediterranean', label: 'Mediterranean' },
  { id: 'asian', label: 'Asian' },
  { id: 'french', label: 'French' },
  { id: 'indian', label: 'Indian' },
  { id: 'other', label: 'Other' },
]

export const MEAL_TYPES: { id: MealTypeId; label: string }[] = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'entree', label: 'Entrée' },
  { id: 'side', label: 'Side' },
  { id: 'dessert', label: 'Dessert' },
  { id: 'cocktail', label: 'Cocktail' },
]

export const CUISINE_LABEL: Record<CuisineId, string> = Object.fromEntries(
  CUISINES.map((c) => [c.id, c.label])
) as Record<CuisineId, string>

export const MEAL_TYPE_LABEL: Record<MealTypeId, string> = Object.fromEntries(
  MEAL_TYPES.map((m) => [m.id, m.label])
) as Record<MealTypeId, string>
