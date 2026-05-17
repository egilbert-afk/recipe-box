'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CuisineId, MealTypeId, CreateRecipeInput } from '@/lib/types'

const CUISINES: { id: CuisineId; label: string }[] = [
  { id: 'american', label: 'American / Comfort Food' },
  { id: 'italian', label: 'Italian' },
  { id: 'mexican', label: 'Mexican' },
  { id: 'mediterranean', label: 'Mediterranean' },
  { id: 'asian', label: 'Asian' },
  { id: 'french', label: 'French' },
  { id: 'indian', label: 'Indian' },
  { id: 'other', label: 'Other' },
]

const MEAL_TYPES: { id: MealTypeId; label: string }[] = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'entree', label: 'Entrée' },
  { id: 'side', label: 'Side' },
  { id: 'dessert', label: 'Dessert' },
  { id: 'cocktail', label: 'Cocktail' },
]

interface IngredientRow {
  name: string
  amount: string
  unit: string
}

interface StepRow {
  instruction: string
}

export default function AddRecipePage() {
  const router = useRouter()

  const [title, setTitle] = useState('')
  const [cuisineId, setCuisineId] = useState<CuisineId | ''>('')
  const [mealTypeId, setMealTypeId] = useState<MealTypeId | ''>('')
  const [servings, setServings] = useState('4')
  const [sourceUrl, setSourceUrl] = useState('')
  const [ingredients, setIngredients] = useState<IngredientRow[]>([
    { name: '', amount: '', unit: '' },
  ])
  const [steps, setSteps] = useState<StepRow[]>([{ instruction: '' }])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function updateIngredient(index: number, field: keyof IngredientRow, value: string) {
    setIngredients((prev) => prev.map((ing, i) => (i === index ? { ...ing, [field]: value } : ing)))
  }

  function addIngredient() {
    setIngredients((prev) => [...prev, { name: '', amount: '', unit: '' }])
  }

  function removeIngredient(index: number) {
    setIngredients((prev) => prev.filter((_, i) => i !== index))
  }

  function updateStep(index: number, value: string) {
    setSteps((prev) => prev.map((s, i) => (i === index ? { instruction: value } : s)))
  }

  function addStep() {
    setSteps((prev) => [...prev, { instruction: '' }])
  }

  function removeStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!cuisineId || !mealTypeId) {
      setError('Please select a cuisine and meal type.')
      return
    }

    const payload: CreateRecipeInput = {
      title,
      cuisine_id: cuisineId,
      meal_type_id: mealTypeId,
      servings: Number(servings),
      source_url: sourceUrl || undefined,
      ingredients: ingredients
        .filter((ing) => ing.name.trim())
        .map((ing, i) => ({
          name: ing.name,
          amount: ing.amount ? Number(ing.amount) : null,
          unit: ing.unit || null,
          order_index: i,
        })),
      steps: steps
        .filter((s) => s.instruction.trim())
        .map((s, i) => ({ instruction: s.instruction, order_index: i })),
    }

    setSubmitting(true)

    const res = await fetch('/api/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await res.json()
    setSubmitting(false)

    if (!res.ok) {
      setError(data.error ?? 'Something went wrong.')
      return
    }

    router.push(`/recipes/${data.id}`)
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="flex items-center gap-3 px-4 py-4 border-b border-gray-200">
        <button
          onClick={() => router.back()}
          className="flex items-center justify-center h-12 w-12 rounded-full text-gray-600 hover:bg-gray-100"
        >
          ←
        </button>
        <h1 className="text-lg font-semibold">Add Recipe</h1>
      </header>

      <form onSubmit={handleSubmit} className="px-4 py-6 space-y-8">
        {error && (
          <p className="text-red-600 text-sm">{error}</p>
        )}

        {/* Title */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full h-12 px-3 border border-gray-300 rounded-lg text-base"
            placeholder="e.g. Roast Chicken"
            required
          />
        </div>

        {/* Cuisine */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Cuisine</label>
          <select
            value={cuisineId}
            onChange={(e) => setCuisineId(e.target.value as CuisineId)}
            className="w-full h-12 px-3 border border-gray-300 rounded-lg text-base bg-white"
            required
          >
            <option value="">Select cuisine</option>
            {CUISINES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>

        {/* Meal type */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Meal type</label>
          <select
            value={mealTypeId}
            onChange={(e) => setMealTypeId(e.target.value as MealTypeId)}
            className="w-full h-12 px-3 border border-gray-300 rounded-lg text-base bg-white"
            required
          >
            <option value="">Select meal type</option>
            {MEAL_TYPES.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* Servings */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Servings</label>
          <input
            type="number"
            min="1"
            value={servings}
            onChange={(e) => setServings(e.target.value)}
            className="w-full h-12 px-3 border border-gray-300 rounded-lg text-base"
            required
          />
        </div>

        {/* Source URL */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Source URL <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            className="w-full h-12 px-3 border border-gray-300 rounded-lg text-base"
            placeholder="https://..."
          />
        </div>

        {/* Ingredients */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-gray-700">Ingredients</h2>
          {ingredients.map((ing, i) => (
            <div key={i} className="flex gap-2 items-start">
              <div className="flex-1 space-y-2">
                <input
                  type="text"
                  value={ing.name}
                  onChange={(e) => updateIngredient(i, 'name', e.target.value)}
                  placeholder="Ingredient"
                  className="w-full h-12 px-3 border border-gray-300 rounded-lg text-base"
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={ing.amount}
                    onChange={(e) => updateIngredient(i, 'amount', e.target.value)}
                    placeholder="Amount"
                    min="0"
                    step="any"
                    className="w-24 h-12 px-3 border border-gray-300 rounded-lg text-base"
                  />
                  <input
                    type="text"
                    value={ing.unit}
                    onChange={(e) => updateIngredient(i, 'unit', e.target.value)}
                    placeholder="Unit (e.g. cups)"
                    className="flex-1 h-12 px-3 border border-gray-300 rounded-lg text-base"
                  />
                </div>
              </div>
              {ingredients.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeIngredient(i)}
                  className="flex items-center justify-center h-12 w-12 text-gray-400 hover:text-red-500"
                  aria-label="Remove ingredient"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addIngredient}
            className="flex items-center justify-center h-12 w-full border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-gray-400"
          >
            + Add ingredient
          </button>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-gray-700">Steps</h2>
          {steps.map((step, i) => (
            <div key={i} className="flex gap-2 items-start">
              <span className="flex-shrink-0 flex items-center justify-center h-12 w-8 text-sm font-medium text-gray-500">
                {i + 1}
              </span>
              <textarea
                value={step.instruction}
                onChange={(e) => updateStep(i, e.target.value)}
                placeholder={`Step ${i + 1}`}
                rows={2}
                className="flex-1 px-3 py-3 border border-gray-300 rounded-lg text-base resize-none"
              />
              {steps.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeStep(i)}
                  className="flex items-center justify-center h-12 w-12 text-gray-400 hover:text-red-500"
                  aria-label="Remove step"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addStep}
            className="flex items-center justify-center h-12 w-full border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-gray-400"
          >
            + Add step
          </button>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="flex items-center justify-center h-14 w-full rounded-full bg-black text-white text-base font-medium disabled:opacity-50"
        >
          {submitting ? 'Saving...' : 'Save Recipe'}
        </button>
      </form>
    </div>
  )
}
