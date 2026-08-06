'use client'
import { useState, useTransition } from 'react'

export function DiscoverOptOut({ initialOptOut }: { initialOptOut: boolean }) {
  const [optedOut, setOptedOut] = useState(initialOptOut)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleToggle() {
    const next = !optedOut
    setError('')
    startTransition(async () => {
      const res = await fetch('/api/households', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discover_opt_out: next }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Something went wrong. Try again.')
        return
      }
      setOptedOut(next)
    })
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        role="switch"
        aria-checked={!optedOut}
        onClick={handleToggle}
        disabled={isPending}
        className="flex items-center gap-3 w-full text-left disabled:opacity-50"
      >
        <span
          className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors ${
            !optedOut ? 'bg-gray-900' : 'bg-gray-200'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
              !optedOut ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </span>
        <span className="text-sm text-gray-900">
          {optedOut ? 'Recipes not shared with community' : 'Recipes shared anonymously with community'}
        </span>
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
