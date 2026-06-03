'use client'
import { useState, useTransition } from 'react'

interface Props {
  initialCode: string
}

export function InviteCode({ initialCode }: Props) {
  const [code, setCode] = useState(initialCode)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard access denied — user can copy the code manually
    }
  }

  function handleRegenerate() {
    setError('')
    startTransition(async () => {
      const res = await fetch('/api/households/invite', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Something went wrong')
        return
      }
      const data = await res.json()
      setCode(data.invite_code)
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <span className="font-mono text-2xl tracking-widest font-semibold">{code}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="text-sm text-gray-500 underline"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <button
        type="button"
        onClick={handleRegenerate}
        disabled={isPending}
        className="text-sm text-red-600 underline disabled:opacity-50"
      >
        {isPending ? 'Regenerating…' : 'Regenerate code'}
      </button>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <p className="text-xs text-gray-400">
        Share this code to invite someone to your household. Regenerating it
        invalidates the old code immediately.
      </p>
    </div>
  )
}
