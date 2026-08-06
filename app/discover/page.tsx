'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Settings, ArrowLeft } from 'lucide-react'
import { CUISINES, MEAL_TYPES, CUISINE_LABEL, MEAL_TYPE_LABEL } from '@/lib/constants'
import type { CuisineId, MealTypeId, DiscoverCard } from '@/lib/types'

const FALLBACK_LINKS = [
  { label: 'The Modern Proper', url: 'https://themodernproper.com' },
  { label: 'Serious Eats', url: 'https://www.seriouseats.com' },
  { label: 'Simply Recipes', url: 'https://www.simplyrecipes.com' },
  { label: 'Punch', url: 'https://punchdrink.com' },
]

function siteNameFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export default function DiscoverPage() {
  const [card, setCard] = useState<DiscoverCard | null>(null)
  const [empty, setEmpty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeCuisine, setActiveCuisine] = useState<CuisineId | null>(null)
  const [activeMealType, setActiveMealType] = useState<MealTypeId | null>(null)
  const fetchCounterRef = useRef(0)

  const fetchCard = useCallback(async (cuisine: CuisineId | null, mealType: MealTypeId | null) => {
    fetchCounterRef.current += 1
    const myFetch = fetchCounterRef.current

    setLoading(true)
    setError(null)
    setEmpty(false)
    setCard(null)
    try {
      const params = new URLSearchParams()
      if (cuisine) params.set('cuisine_id', cuisine)
      if (mealType) params.set('meal_type_id', mealType)
      const res = await fetch(`/api/discover?${params}`)
      if (fetchCounterRef.current !== myFetch) return
      if (!res.ok) {
        setError('Something went wrong. Try again in a moment.')
        return
      }
      const data = await res.json()
      if (fetchCounterRef.current !== myFetch) return
      if (data.empty) {
        setEmpty(true)
      } else {
        setCard(data.card)
      }
    } catch {
      if (fetchCounterRef.current !== myFetch) return
      setError('Something went wrong. Try again in a moment.')
    } finally {
      if (fetchCounterRef.current === myFetch) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    fetchCard(activeCuisine, activeMealType)
  }, [fetchCard, activeCuisine, activeMealType])

  async function handleAdd() {
    if (!card) return
    setActionLoading(true)
    try {
      const res = await fetch('/api/discover/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipe_id: card.id }),
      })
      if (!res.ok) {
        const body = await res.json()
        setError(body.error ?? "Couldn't save the recipe. Try again.")
        return
      }
    } catch {
      setError("Couldn't save the recipe. Try again.")
      return
    } finally {
      setActionLoading(false)
    }
    fetchCard(activeCuisine, activeMealType)
  }

  async function handleDismiss() {
    if (!card) return
    setActionLoading(true)
    try {
      await fetch('/api/discover/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipe_id: card.id }),
      })
    } catch {
      // Dismissal failure is non-fatal — move on anyway
    } finally {
      setActionLoading(false)
    }
    fetchCard(activeCuisine, activeMealType)
  }

  function toggleCuisine(id: CuisineId) {
    setActiveCuisine((prev) => (prev === id ? null : id))
  }

  function toggleMealType(id: MealTypeId) {
    setActiveMealType((prev) => (prev === id ? null : id))
  }

  return (
    <div className="min-h-screen bg-white pb-20">
      <div className="max-w-lg mx-auto">
        <header className="flex items-center gap-3 px-4 py-4 border-b border-gray-200">
          <h1 className="flex-1 text-xl font-semibold">Discover</h1>
          <Link
            href="/settings"
            className="flex items-center justify-center h-10 w-10 rounded-full text-gray-600 hover:bg-gray-100"
            aria-label="Settings"
          >
            <Settings size={20} />
          </Link>
        </header>

        {/* Filter chips — meal type */}
        <div className="px-4 pt-4 pb-2 flex flex-wrap gap-2">
          {MEAL_TYPES.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => toggleMealType(id)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                activeMealType === id
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-gray-700 border-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Filter chips — cuisine */}
        <div className="px-4 pb-4 flex flex-wrap gap-2">
          {CUISINES.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => toggleCuisine(id)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                activeCuisine === id
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-gray-700 border-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Content area */}
        <div className="px-4">
          {loading && (
            <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
              Loading…
            </div>
          )}

          {!loading && error && (
            <div className="py-8 text-center">
              <p className="text-red-600 text-sm mb-3">{error}</p>
              <button
                onClick={() => fetchCard(activeCuisine, activeMealType)}
                className="text-sm text-gray-600 underline"
              >
                Try again
              </button>
            </div>
          )}

          {!loading && !error && empty && (
            <div className="py-8">
              <p className="text-gray-600 text-sm mb-6 text-center">
                No community recipes match these filters yet.
                <br />
                Here are some great places to explore:
              </p>
              <div className="space-y-3">
                {FALLBACK_LINKS.map(({ label, url }) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 hover:border-gray-400 transition-colors"
                  >
                    <span className="font-medium text-gray-900">{label}</span>
                    <ArrowLeft size={16} className="text-gray-400 rotate-180" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {!loading && !error && card && (
            <div className="rounded-2xl border border-gray-200 overflow-hidden">
              {/* Card header */}
              <div className="px-5 pt-5 pb-4 border-b border-gray-100">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">{card.title}</h2>
                <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                  <span className="px-2 py-0.5 rounded-full bg-gray-100">
                    {MEAL_TYPE_LABEL[card.meal_type_id]}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-gray-100">
                    {CUISINE_LABEL[card.cuisine_id]}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-gray-100">
                    {card.servings} {card.servings === 1 ? 'serving' : 'servings'}
                  </span>
                </div>
              </div>

              {/* Ingredients */}
              {card.ingredients.length > 0 && (
                <div className="px-5 py-4 border-b border-gray-100">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                    Ingredients
                  </p>
                  <ul className="space-y-1 text-sm text-gray-700">
                    {card.ingredients.slice(0, 8).map((ing, i) => (
                      <li key={i}>
                        {ing.amount != null ? (
                          <span className="text-gray-500">{ing.amount}{ing.unit ? ` ${ing.unit}` : ''} </span>
                        ) : null}
                        {ing.name}
                      </li>
                    ))}
                    {card.ingredients.length > 8 && (
                      <li className="text-gray-400 text-xs">
                        + {card.ingredients.length - 8} more — see the full recipe
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {/* Actions */}
              <div className="px-5 py-4 space-y-2">
                <a
                  href={card.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center w-full h-12 rounded-xl bg-black text-white text-sm font-medium hover:bg-gray-800 transition-colors"
                >
                  View on {siteNameFromUrl(card.source_url)}
                </a>
                <button
                  onClick={handleAdd}
                  disabled={actionLoading}
                  className="flex items-center justify-center w-full h-12 rounded-xl border border-gray-300 text-sm font-medium text-gray-900 hover:border-gray-500 transition-colors disabled:opacity-50"
                >
                  {actionLoading ? 'Saving…' : 'Add to My Recipes'}
                </button>
                <button
                  onClick={handleDismiss}
                  disabled={actionLoading}
                  className="flex items-center justify-center w-full h-10 text-sm text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
                >
                  Not for us
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
