'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import type { Ingredient, Step } from '@/lib/types'
import { formatAmount } from '@/lib/scaler'
import { formatIngredient } from '@/lib/formatters'

type Props = {
  title: string
  recipeId: string
  baseServings: number
  targetServings: number
  ingredients: Ingredient[]
  steps: Step[]
}

export function CookMode({ title, recipeId, baseServings, targetServings, ingredients, steps }: Props) {
  const [currentStep, setCurrentStep] = useState(0)
  const [ingredientsOpen, setIngredientsOpen] = useState(false)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_name: 'cooking_mode_started', properties: { recipe_id: recipeId } }),
    }).catch(() => {})
  }, [recipeId])

  useEffect(() => {
    if (!('wakeLock' in navigator)) return

    let unmounted = false

    const requestLock = async () => {
      try {
        const lock = await navigator.wakeLock.request('screen')
        if (unmounted) {
          // Component unmounted while the promise was in flight — release immediately
          lock.release()
          return
        }
        // Null the ref when the browser auto-releases (e.g. page hidden),
        // so the cleanup handler doesn't try to release an already-released lock.
        lock.addEventListener('release', () => { wakeLockRef.current = null })
        wakeLockRef.current = lock
      } catch {
        // Non-critical — lock may be unavailable if the page is hidden
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') requestLock()
    }

    requestLock()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      unmounted = true
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      wakeLockRef.current?.release()
      wakeLockRef.current = null
    }
  }, [])

  const totalSteps = steps.length

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="flex items-center gap-3 px-4 py-4 border-b border-gray-200">
        <Link
          href={`/recipes/${recipeId}`}
          className="flex items-center justify-center h-12 w-12 rounded-full text-gray-600 hover:bg-gray-100"
        >
          ←
        </Link>
        <h1 className="text-lg font-semibold flex-1 truncate">{title}</h1>
      </header>

      {/* Ingredients — collapsed by default */}
      <div className="border-b border-gray-200">
        <button
          onClick={() => setIngredientsOpen((o) => !o)}
          aria-expanded={ingredientsOpen}
          className="flex items-center justify-between w-full px-4 py-4 text-base font-semibold text-left"
        >
          <span>
            Ingredients
            {targetServings !== baseServings && (
              <span className="ml-1 font-normal text-gray-500 text-sm">({targetServings} servings)</span>
            )}
          </span>
          <span className="text-gray-400 text-sm">{ingredientsOpen ? '▲' : '▼'}</span>
        </button>
        {ingredientsOpen && (
          <ul className="px-4 pb-4 space-y-2">
            {ingredients.map((ing) => (
              <li key={ing.id} className="text-lg text-gray-800">
                {formatIngredient(
                  ing.name,
                  formatAmount(ing.amount, baseServings, targetServings),
                  ing.unit
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Current step */}
      <main className="flex-1 flex flex-col px-4 py-6">
        <p className="text-sm text-gray-400 mb-4 font-medium tracking-wide uppercase">
          Step {currentStep + 1} of {totalSteps}
        </p>
        <p className="text-xl leading-relaxed text-gray-900">
          {steps[currentStep]?.instruction}
        </p>
      </main>

      {/* Step navigation */}
      <div className="flex gap-3 px-4 py-6 border-t border-gray-200">
        <button
          onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
          disabled={currentStep === 0}
          className="flex-1 flex items-center justify-center h-14 rounded-full border border-gray-300 text-base font-medium disabled:opacity-30"
        >
          ← Prev
        </button>
        <button
          onClick={() => setCurrentStep((s) => Math.min(totalSteps - 1, s + 1))}
          disabled={currentStep === totalSteps - 1}
          className="flex-1 flex items-center justify-center h-14 rounded-full bg-black text-white text-base font-medium disabled:opacity-30"
        >
          Next →
        </button>
      </div>
    </div>
  )
}
