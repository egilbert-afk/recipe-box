'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function SaveRecipeButton({ token }: { token: string }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/share/${token}/save`, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error ?? 'Failed to save recipe')
      }
      const { recipe_id } = await res.json()
      router.push(`/recipes/${recipe_id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleSave}
        disabled={saving}
        className="block w-full h-12 rounded-full bg-black text-white text-sm font-medium flex items-center justify-center disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save to my kitchen'}
      </button>
      {error && <p className="text-sm text-red-500 text-center">{error}</p>}
    </div>
  )
}
