'use client'
import { useState } from 'react'
import Link from 'next/link'

type Props = {
  recipeId: string
  baseServings: number
}

export function ServingsPicker({ recipeId, baseServings }: Props) {
  const [servings, setServings] = useState(baseServings)

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setServings((s) => Math.max(1, s - 1))}
          aria-label="Decrease servings"
          className="flex items-center justify-center h-12 w-12 rounded-full border border-gray-300 text-xl font-medium leading-none"
        >
          −
        </button>
        <span className="text-base font-medium w-28 text-center">
          {servings} {servings === 1 ? 'serving' : 'servings'}
        </span>
        <button
          onClick={() => setServings((s) => Math.min(20, s + 1))}
          aria-label="Increase servings"
          className="flex items-center justify-center h-12 w-12 rounded-full border border-gray-300 text-xl font-medium leading-none"
        >
          +
        </button>
      </div>
      <Link
        href={`/recipes/${recipeId}/cook?servings=${servings}`}
        className="flex items-center justify-center h-12 px-5 rounded-full bg-black text-white text-sm font-medium"
      >
        Start Cooking
      </Link>
    </div>
  )
}
