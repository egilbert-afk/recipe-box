'use client'

import { useState } from 'react'
import { Share } from 'lucide-react'

type Status = 'idle' | 'loading' | 'copied' | 'error'

export function ShareButton({ recipeId, recipeTitle }: { recipeId: string; recipeTitle: string }) {
  const [status, setStatus] = useState<Status>('idle')

  async function handleShare() {
    setStatus('loading')
    try {
      const res = await fetch(`/api/recipes/${recipeId}/share`, { method: 'POST' })
      if (!res.ok) throw new Error('Could not generate share link')
      const { share_token } = await res.json()
      const url = `${window.location.origin}/r/${share_token}`

      if (navigator.share) {
        await navigator.share({ title: recipeTitle, url })
        setStatus('idle')
      } else {
        await navigator.clipboard.writeText(url)
        setStatus('copied')
        setTimeout(() => setStatus('idle'), 2000)
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setStatus('idle')
      } else {
        setStatus('error')
        setTimeout(() => setStatus('idle'), 2000)
      }
    }
  }

  return (
    <div className="flex-shrink-0 flex flex-col items-center">
      <button
        onClick={handleShare}
        disabled={status === 'loading'}
        className="flex items-center justify-center h-12 w-12 rounded-full text-gray-400 hover:bg-gray-100 disabled:opacity-50"
        aria-label="Share recipe"
      >
        <Share size={20} />
      </button>
      {status === 'copied' && <span className="text-xs text-gray-500 -mt-1">Copied!</span>}
      {status === 'error' && <span className="text-xs text-red-500 -mt-1">Failed</span>}
    </div>
  )
}
