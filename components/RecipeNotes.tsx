'use client'
import { useState } from 'react'

const COLLAPSE_THRESHOLD = 120

export function RecipeNotes({ notes }: { notes: string }) {
  const isLong = notes.length > COLLAPSE_THRESHOLD
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 space-y-1">
      <p className={`text-sm text-gray-700 leading-relaxed ${isLong && !expanded ? 'line-clamp-2' : ''}`}>
        {notes}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="text-xs font-medium text-gray-500"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  )
}
