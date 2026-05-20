'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CUISINES, MEAL_TYPES } from '@/lib/constants'
import type { CuisineId, MealTypeId, CreateRecipeInput } from '@/lib/types'

type CaptureMode = 'url' | 'upload' | 'manual'

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

function emptyIngredient(id: number): IngredientRow {
  return { id, name: '', amount: '', unit: '' }
}

function emptyStep(id: number): StepRow {
  return { id, instruction: '' }
}

export default function AddRecipePage() {
  const router = useRouter()

  const [mode, setMode] = useState<CaptureMode>('url')
  const [urlInput, setUrlInput] = useState('')
  const [fetching, setFetching] = useState(false)
  const [fetchError, setFetchError] = useState('')

  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([])
  const [textInput, setTextInput] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [uploading, setUploading] = useState(false)

  const [title, setTitle] = useState('')
  const [cuisineId, setCuisineId] = useState<CuisineId | ''>('')
  const [mealTypeId, setMealTypeId] = useState<MealTypeId | ''>('')
  const [servings, setServings] = useState('4')
  const [sourceUrl, setSourceUrl] = useState('')
  const [nextId, setNextId] = useState(2)
  const [ingredients, setIngredients] = useState<IngredientRow[]>([emptyIngredient(0)])
  const [steps, setSteps] = useState<StepRow[]>([emptyStep(1)])
  const [formVisible, setFormVisible] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function prefillForm(data: CreateRecipeInput) {
    setTitle(data.title)
    setCuisineId(data.cuisine_id)
    setMealTypeId(data.meal_type_id)
    setServings(String(data.servings))
    setSourceUrl(data.source_url ?? '')
    let id = 0
    setIngredients(
      data.ingredients.map((ing) => ({
        id: id++,
        name: ing.name,
        amount: ing.amount !== null ? String(ing.amount) : '',
        unit: ing.unit ?? '',
      }))
    )
    setSteps(data.steps.map((s) => ({ id: id++, instruction: s.instruction })))
    setNextId(id)
    setFormVisible(true)
  }

  async function handleFetchUrl() {
    setFetchError('')
    if (!urlInput.trim()) return

    setFetching(true)
    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        setFetchError(data.error ?? 'Could not parse recipe. Try entering it manually.')
        return
      }

      prefillForm(data)
    } finally {
      setFetching(false)
    }
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image must be under 5 MB.')
      e.target.value = ''
      return
    }
    setUploadError('')
    setImageFiles((prev) => [...prev, file])
    setImagePreviewUrls((prev) => [...prev, URL.createObjectURL(file)])
    e.target.value = ''
  }

  function removeImage(index: number) {
    URL.revokeObjectURL(imagePreviewUrls[index])
    setImageFiles((prev) => prev.filter((_, i) => i !== index))
    setImagePreviewUrls((prev) => prev.filter((_, i) => i !== index))
  }

  async function handlePhotoSubmit() {
    if (!imageFiles.length) return
    setUploadError('')
    setUploading(true)
    try {
      const images = await Promise.all(
        imageFiles.map(
          (file) =>
            new Promise<{ data: string; mimeType: string }>((resolve, reject) => {
              const reader = new FileReader()
              reader.onload = () =>
                resolve({ data: (reader.result as string).split(',')[1], mimeType: file.type })
              reader.onerror = reject
              reader.readAsDataURL(file)
            })
        )
      )
      const res = await fetch('/api/parse-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images }),
      })
      const data = await res.json()
      if (!res.ok) {
        setUploadError(data.error ?? 'Could not read photo. Try entering the recipe manually.')
        return
      }
      prefillForm(data)
    } catch {
      setUploadError('Something went wrong reading the photo. Try again.')
    } finally {
      setUploading(false)
    }
  }

  async function handleTextSubmit() {
    if (!textInput.trim()) return
    setUploadError('')
    setUploading(true)
    try {
      const res = await fetch('/api/parse-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textInput.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setUploadError(data.error ?? 'Could not parse recipe. Try entering it manually.')
        return
      }
      prefillForm(data)
    } catch {
      setUploadError('Something went wrong. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  function updateIngredient(index: number, field: Exclude<keyof IngredientRow, 'id'>, value: string) {
    setIngredients((prev) => prev.map((ing, i) => (i === index ? { ...ing, [field]: value } : ing)))
  }

  function addIngredient() {
    setIngredients((prev) => [...prev, emptyIngredient(nextId)])
    setNextId((n) => n + 1)
  }

  function removeIngredient(index: number) {
    setIngredients((prev) => prev.filter((_, i) => i !== index))
  }

  function updateStep(index: number, value: string) {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, instruction: value } : s)))
  }

  function addStep() {
    setSteps((prev) => [...prev, emptyStep(nextId)])
    setNextId((n) => n + 1)
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
    try {
      const res = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong.')
        return
      }

      router.push(`/recipes/${data.id}`)
    } finally {
      setSubmitting(false)
    }
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

      <div className="px-4 py-6 space-y-6">
        {/* Mode toggle */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          <button
            type="button"
            onClick={() => { setMode('url'); setFormVisible(false) }}
            className={`flex-1 h-12 text-sm font-medium transition-colors ${
              mode === 'url' ? 'bg-black text-white' : 'bg-white text-gray-600'
            }`}
          >
            Paste URL
          </button>
          <button
            type="button"
            onClick={() => { setMode('upload'); setFormVisible(false) }}
            className={`flex-1 h-12 text-sm font-medium transition-colors ${
              mode === 'upload' ? 'bg-black text-white' : 'bg-white text-gray-600'
            }`}
          >
            Photo / Text
          </button>
          <button
            type="button"
            onClick={() => { setMode('manual'); setFormVisible(true) }}
            className={`flex-1 h-12 text-sm font-medium transition-colors ${
              mode === 'manual' ? 'bg-black text-white' : 'bg-white text-gray-600'
            }`}
          >
            Type it in
          </button>
        </div>

        {/* URL capture */}
        {mode === 'url' && (
          <div className="space-y-3">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://www.seriouseats.com/..."
              className="w-full h-12 px-3 border border-gray-300 rounded-lg text-base"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleFetchUrl() } }}
            />
            {fetchError && <p className="text-red-600 text-sm">{fetchError}</p>}
            <button
              type="button"
              onClick={handleFetchUrl}
              disabled={fetching || !urlInput.trim()}
              className="flex items-center justify-center h-12 w-full rounded-full bg-black text-white text-sm font-medium disabled:opacity-50"
            >
              {fetching ? 'Fetching recipe...' : 'Fetch Recipe'}
            </button>
            {fetching && (
              <p className="text-sm text-gray-500 text-center">
                Claude is reading the page and extracting the recipe — this takes about 10 seconds.
              </p>
            )}
          </div>
        )}

        {/* Photo / Text capture */}
        {mode === 'upload' && (
          <div className="space-y-6">
            {/* Photo section */}
            <div className="space-y-3">
              {/* Thumbnail strip */}
              {imagePreviewUrls.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {imagePreviewUrls.map((url, i) => (
                    <div key={i} className="relative flex-shrink-0">
                      <img
                        src={url}
                        alt={`Page ${i + 1}`}
                        className="h-20 w-20 object-cover rounded-lg border border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-gray-800 text-white text-xs flex items-center justify-center"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Drop zone (empty state) or Add another page */}
              <label className="block cursor-pointer">
                {imagePreviewUrls.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-36 w-full border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400">
                    <p className="text-sm font-medium text-gray-700">Take photo or upload image</p>
                    <p className="text-xs text-gray-400 mt-1">JPEG, PNG, WebP · max 5 MB</p>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-12 w-full border border-gray-300 rounded-full text-sm text-gray-600 hover:border-gray-400">
                    + Add another page
                  </div>
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  onChange={handleImageSelect}
                />
              </label>

              <button
                type="button"
                onClick={handlePhotoSubmit}
                disabled={imageFiles.length === 0 || uploading}
                className="flex items-center justify-center h-12 w-full rounded-full bg-black text-white text-sm font-medium disabled:opacity-50"
              >
                {uploading
                  ? 'Reading photo...'
                  : imageFiles.length > 1
                    ? `Parse ${imageFiles.length} Photos`
                    : 'Parse Photo'}
              </button>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400 uppercase tracking-wide">or paste recipe text</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Text paste section */}
            <div className="space-y-3">
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Paste recipe text here — ingredients, steps, anything Claude can read..."
                rows={6}
                className="w-full px-3 py-3 border border-gray-300 rounded-lg text-base resize-none"
              />
              <button
                type="button"
                onClick={handleTextSubmit}
                disabled={!textInput.trim() || uploading}
                className="flex items-center justify-center h-12 w-full rounded-full bg-black text-white text-sm font-medium disabled:opacity-50"
              >
                {uploading ? 'Reading recipe...' : 'Parse Text'}
              </button>
            </div>

            {uploadError && <p className="text-red-600 text-sm">{uploadError}</p>}
            {uploading && (
              <p className="text-sm text-gray-500 text-center">
                Claude is reading the recipe — this takes about 10 seconds.
              </p>
            )}
          </div>
        )}

        {/* Recipe form — shown after URL parse or in manual mode */}
        {formVisible && (
          <form onSubmit={handleSubmit} className="space-y-8">
            {mode !== 'manual' && (
              <p className="text-sm text-gray-500">
                Review the extracted recipe below. Edit anything that looks off, then save.
              </p>
            )}

            {error && <p className="text-red-600 text-sm">{error}</p>}

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
              <p className="text-sm text-gray-500">If the recipe says a range (e.g. 3–4), enter the larger number.</p>
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
              <div>
                <h2 className="text-sm font-medium text-gray-700">Ingredients</h2>
                <p className="text-sm text-gray-500">Add one ingredient per row.</p>
              </div>
              {ingredients.map((ing, i) => (
                <div key={ing.id} className="flex gap-2 items-start">
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
              <div>
                <h2 className="text-sm font-medium text-gray-700">Steps</h2>
                <p className="text-sm text-gray-500">Add one step per box, in order.</p>
              </div>
              {steps.map((step, i) => (
                <div key={step.id} className="flex gap-2 items-start">
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
        )}
      </div>
    </div>
  )
}
