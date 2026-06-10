'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CUISINES, MEAL_TYPES } from '@/lib/constants'
import type { Recipe, Ingredient, Step, CuisineId, MealTypeId } from '@/lib/types'

interface IngredientRow {
  id: number
  name: string
  amount: string
  unit: string
}

interface StepRow {
  id: number
  instruction: string
}

type Props = {
  recipe: Recipe
  ingredients: Ingredient[]
  steps: Step[]
}

export function EditRecipeForm({ recipe, ingredients, steps }: Props) {
  const router = useRouter()

  const [title, setTitle] = useState(recipe.title)
  const [cuisineId, setCuisineId] = useState<CuisineId>(recipe.cuisine_id)
  const [mealTypeId, setMealTypeId] = useState<MealTypeId>(recipe.meal_type_id)
  const [servings, setServings] = useState(String(recipe.servings))
  const [notes, setNotes] = useState(recipe.notes ?? '')

  let rowId = 0
  const [ingredientRows, setIngredientRows] = useState<IngredientRow[]>(
    ingredients.map((ing) => ({
      id: rowId++,
      name: ing.name,
      amount: ing.amount !== null ? String(ing.amount) : '',
      unit: ing.unit ?? '',
    }))
  )
  const [stepRows, setStepRows] = useState<StepRow[]>(
    steps.map((s) => ({ id: rowId++, instruction: s.instruction }))
  )
  const [nextId, setNextId] = useState(rowId)

  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function updateIngredient(index: number, field: Exclude<keyof IngredientRow, 'id'>, value: string) {
    setIngredientRows((prev) => prev.map((ing, i) => (i === index ? { ...ing, [field]: value } : ing)))
  }

  function addIngredient() {
    setIngredientRows((prev) => [...prev, { id: nextId, name: '', amount: '', unit: '' }])
    setNextId((n) => n + 1)
  }

  function removeIngredient(index: number) {
    setIngredientRows((prev) => prev.filter((_, i) => i !== index))
  }

  function updateStep(index: number, value: string) {
    setStepRows((prev) => prev.map((s, i) => (i === index ? { ...s, instruction: value } : s)))
  }

  function addStep() {
    setStepRows((prev) => [...prev, { id: nextId, instruction: '' }])
    setNextId((n) => n + 1)
  }

  function removeStep(index: number) {
    setStepRows((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const badAmount = ingredientRows.find(
      (ing) => ing.name.trim() && ing.amount !== '' && !Number.isFinite(Number(ing.amount))
    )
    if (badAmount) {
      setError(`"${badAmount.amount}" is not a valid amount — use a number like 1, 0.5, or 2.25`)
      return
    }

    const payload = {
      title,
      cuisine_id: cuisineId,
      meal_type_id: mealTypeId,
      servings: Number(servings),
      notes: notes.trim() || undefined,
      ingredients: ingredientRows
        .filter((ing) => ing.name.trim())
        .map((ing, i) => ({
          name: ing.name,
          amount: ing.amount ? Number(ing.amount) : null,
          unit: ing.unit || null,
          order_index: i,
        })),
      steps: stepRows
        .filter((s) => s.instruction.trim())
        .map((s, i) => ({ instruction: s.instruction, order_index: i })),
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/recipes/${recipe.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? "Couldn't save changes. Try again.")
        return
      }

      router.push(`/recipes/${recipe.id}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-white pb-20">
      <header className="flex items-center gap-3 px-4 py-4 border-b border-gray-200">
        <button
          type="button"
          onClick={() => router.push(`/recipes/${recipe.id}`)}
          className="flex items-center justify-center h-12 w-12 rounded-full text-gray-600 hover:bg-gray-100"
        >
          ←
        </button>
        <h1 className="text-lg font-semibold flex-1">Edit Recipe</h1>
      </header>

      <div className="px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-8">
          {error && <p className="text-red-600 text-sm">{error}</p>}

          {/* Source URL — read only */}
          {recipe.source_url && (
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-500">Original source</p>
              <a
                href={recipe.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 underline break-all"
              >
                {recipe.source_url}
              </a>
            </div>
          )}

          {/* Title */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full h-12 px-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-gray-900"
              required
            />
          </div>

          {/* Cuisine */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Cuisine</label>
            <select
              value={cuisineId}
              onChange={(e) => setCuisineId(e.target.value as CuisineId)}
              className="w-full h-12 px-3 border border-gray-300 rounded-lg text-base bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
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
              className="w-full h-12 px-3 border border-gray-300 rounded-lg text-base bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
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
              max="100"
              value={servings}
              onChange={(e) => setServings(e.target.value)}
              className="w-24 h-12 px-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-gray-900"
              required
            />
          </div>

          {/* Ingredients */}
          <div className="space-y-3">
            <div>
              <h2 className="text-sm font-medium text-gray-700">Ingredients</h2>
              <p className="text-sm text-gray-500">One ingredient per row.</p>
            </div>
            {ingredientRows.map((ing, i) => (
              <div key={ing.id} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={ing.amount}
                  onChange={(e) => updateIngredient(i, 'amount', e.target.value)}
                  placeholder="Amount"
                  className="w-20 h-12 px-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
                <input
                  type="text"
                  value={ing.unit}
                  onChange={(e) => updateIngredient(i, 'unit', e.target.value)}
                  placeholder="Unit"
                  className="w-20 h-12 px-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
                <input
                  type="text"
                  value={ing.name}
                  onChange={(e) => updateIngredient(i, 'name', e.target.value)}
                  placeholder="Ingredient"
                  className="flex-1 h-12 px-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
                {ingredientRows.length > 1 && (
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
            <div>
              <h2 className="text-sm font-medium text-gray-700">Steps</h2>
              <p className="text-sm text-gray-500">One step per box, in order.</p>
            </div>
            {stepRows.map((step, i) => (
              <div key={step.id} className="flex gap-2 items-start">
                <span className="flex-shrink-0 flex items-center justify-center h-12 w-8 text-sm font-medium text-gray-500">
                  {i + 1}
                </span>
                <textarea
                  value={step.instruction}
                  onChange={(e) => updateStep(i, e.target.value)}
                  placeholder={`Step ${i + 1}`}
                  rows={2}
                  className="flex-1 px-3 py-3 border border-gray-300 rounded-lg text-base resize-none focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
                {stepRows.length > 1 && (
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

          {/* Notes */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Your notes <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Substitutions, tweaks, things to remember…"
              rows={3}
              maxLength={1000}
              className="w-full px-3 py-3 border border-gray-300 rounded-lg text-base resize-none focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="flex items-center justify-center h-14 w-full rounded-full bg-black text-white text-base font-medium disabled:opacity-50"
          >
            {submitting ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </div>
    </div>
  )
}
