export type CuisineId =
  | 'american'
  | 'italian'
  | 'mexican'
  | 'mediterranean'
  | 'asian'
  | 'french'
  | 'indian'
  | 'other'

export type MealTypeId =
  | 'breakfast'
  | 'entree'
  | 'side'
  | 'dessert'
  | 'cocktail'

export type CaptureMethod = 'manual' | 'url' | 'document' | 'email' | 'text_paste'

export interface Cuisine {
  id: CuisineId
  label: string
}

export interface MealType {
  id: MealTypeId
  label: string
}

export interface Ingredient {
  id: string
  recipe_id: string
  name: string
  amount: number | null
  unit: string | null
  order_index: number
}

export interface Step {
  id: string
  recipe_id: string
  instruction: string
  order_index: number
}

export interface Recipe {
  id: string
  title: string
  cuisine_id: CuisineId
  meal_type_id: MealTypeId
  source_url: string | null
  servings: number
  archived: boolean
  archive_note: string | null
  capture_method: CaptureMethod
  created_at: string
  updated_at: string
}

export interface RecipeWithDetails extends Recipe {
  ingredients: Ingredient[]
  steps: Step[]
}

// Shape of the form data when creating a recipe manually
export interface CreateRecipeInput {
  title: string
  cuisine_id: CuisineId
  meal_type_id: MealTypeId
  source_url?: string
  servings: number
  ingredients: Array<{
    name: string
    amount: number | null
    unit: string | null
    order_index: number
  }>
  steps: Array<{
    instruction: string
    order_index: number
  }>
}
