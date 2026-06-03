'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  recipeId: string
  archived: boolean
  redirectAfter?: string
}

export function ArchiveButton({ recipeId, archived, redirectAfter = '/recipes' }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSubmit(archiving: boolean) {
    setError('')
    startTransition(async () => {
      const res = await fetch(`/api/recipes/${recipeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          archived: archiving,
          archive_note: archiving ? note : null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Something went wrong')
        return
      }
      router.push(redirectAfter)
    })
  }

  if (archived) {
    return (
      <button
        type="button"
        onClick={() => handleSubmit(false)}
        disabled={isPending}
        className="h-12 px-5 rounded-full border border-gray-300 text-sm font-medium text-gray-700 disabled:opacity-50"
      >
        {isPending ? 'Restoring…' : 'Restore recipe'}
      </button>
    )
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="h-12 px-5 rounded-full border border-gray-300 text-sm font-medium text-gray-700"
      >
        Archive
      </button>
    )
  }

  return (
    <div className="space-y-3 border border-gray-200 rounded-2xl p-4">
      <p className="text-sm font-medium text-gray-700">Archive this recipe?</p>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Why are you archiving this? (optional)"
        rows={3}
        maxLength={500}
        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-base resize-none"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => handleSubmit(true)}
          disabled={isPending}
          className="h-12 px-5 rounded-full bg-black text-white text-sm font-medium disabled:opacity-50"
        >
          {isPending ? 'Archiving…' : 'Archive recipe'}
        </button>
        <button
          type="button"
          onClick={() => { setExpanded(false); setNote('') }}
          disabled={isPending}
          className="h-12 px-5 rounded-full border border-gray-300 text-sm font-medium text-gray-700 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
