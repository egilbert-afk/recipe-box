'use client'
import { useState, useTransition } from 'react'

export function KitchenNameEditor({ initialName }: { initialName: string }) {
  const [name, setName] = useState(initialName)
  const [savedName, setSavedName] = useState(initialName)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    if (!name.trim() || name.trim() === savedName) return
    setError('')
    setSaved(false)
    startTransition(async () => {
      const res = await fetch('/api/households', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Something went wrong. Please try again.')
        return
      }
      setSavedName(name.trim())
      setSaved(true)
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={e => { setName(e.target.value); setSaved(false) }}
          maxLength={100}
          disabled={isPending}
          className="flex-1 h-12 px-4 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending || !name.trim() || name.trim() === savedName}
          className="h-12 px-5 bg-gray-900 text-white rounded-xl text-sm font-medium disabled:opacity-40"
        >
          {isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
      {saved && <p className="text-sm text-green-600">Kitchen name updated.</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
