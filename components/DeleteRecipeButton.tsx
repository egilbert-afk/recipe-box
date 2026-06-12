'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export function DeleteRecipeButton({ recipeId }: { recipeId: string }) {
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleDelete() {
    setError('')
    startTransition(async () => {
      const res = await fetch(`/api/recipes/${recipeId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Something went wrong')
        return
      }
      setConfirming(false)
      router.refresh()
    })
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="h-12 px-4 rounded-full border border-red-200 text-sm font-medium text-red-600"
      >
        Delete permanently
      </button>
    )
  }

  return (
    <div className="space-y-3 border border-red-200 rounded-2xl p-4 mt-2">
      <p className="text-sm font-medium text-gray-700">Permanently delete this recipe? This cannot be undone.</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className="h-12 px-5 rounded-full bg-red-600 text-white text-sm font-medium disabled:opacity-50"
        >
          {isPending ? 'Deleting…' : 'Yes, delete it'}
        </button>
        <button
          type="button"
          onClick={() => { setConfirming(false); setError('') }}
          disabled={isPending}
          className="h-12 px-5 rounded-full border border-gray-300 text-sm font-medium text-gray-700 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
