'use client'
import { useState } from 'react'

export function InviteCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard unavailable — user can select and copy manually
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">
        Share this code with anyone you want to invite to your kitchen.
      </p>
      <div className="flex gap-2">
        <div className="flex-1 h-12 px-4 border border-gray-200 rounded-xl bg-gray-50 flex items-center font-mono text-lg tracking-widest text-gray-900">
          {code}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="h-12 px-5 bg-gray-900 text-white rounded-xl text-sm font-medium"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  )
}
