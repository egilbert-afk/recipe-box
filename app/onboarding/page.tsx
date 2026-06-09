'use client'
import { useState, useTransition } from 'react'

type Mode = 'create' | 'join'

export default function OnboardingPage() {
  const [mode, setMode] = useState<Mode>('create')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function switchMode(next: Mode) {
    setMode(next)
    setError('')
  }

  function handleCreate() {
    setError('')
    startTransition(async () => {
      const res = await fetch('/api/households', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() || 'My Kitchen' }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Something went wrong. Please try again.')
        return
      }
      window.location.href = '/recipes'
    })
  }

  function handleJoin() {
    setError('')
    startTransition(async () => {
      const res = await fetch('/api/households/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invite_code: code.trim() }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Something went wrong. Please try again.')
        return
      }
      window.location.href = '/recipes'
    })
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <h1 className="text-2xl font-semibold mb-3">Welcome to Recipe Box</h1>
      <p className="text-gray-500 text-center text-sm leading-relaxed mb-8 max-w-sm">
        Recipe Box keeps your family's recipes in one place. A kitchen is your household's shared space. Add recipes together, cook from the same collection.
      </p>

      <div className="flex w-full max-w-sm mb-6 rounded-lg overflow-hidden border border-gray-200">
        <button
          type="button"
          onClick={() => switchMode('create')}
          disabled={isPending}
          className={`flex-1 py-3 text-sm font-medium transition-colors disabled:opacity-50 ${
            mode === 'create' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600'
          }`}
        >
          Create a kitchen
        </button>
        <button
          type="button"
          onClick={() => switchMode('join')}
          disabled={isPending}
          className={`flex-1 py-3 text-sm font-medium transition-colors disabled:opacity-50 ${
            mode === 'join' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600'
          }`}
        >
          Join a kitchen
        </button>
      </div>

      <div className="w-full max-w-sm space-y-4">
        {mode === 'create' ? (
          <>
            <input
              type="text"
              placeholder="Kitchen name (optional, e.g. The Gilberts)"
              value={name}
              onChange={e => setName(e.target.value)}
              disabled={isPending}
              maxLength={100}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:opacity-50"
            />
            <p className="text-xs text-gray-400 text-center">You can invite household members from settings after setup.</p>
            <button
              type="button"
              onClick={handleCreate}
              disabled={isPending}
              className="w-full bg-gray-900 text-white rounded-lg py-3 text-base font-medium disabled:opacity-50"
            >
              {isPending ? 'Setting up…' : "Let's go"}
            </button>
          </>
        ) : (
          <>
            <input
              type="text"
              placeholder="Invite code (e.g. A1B2C3D4)"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              disabled={isPending}
              maxLength={8}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base font-mono uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={handleJoin}
              disabled={isPending || code.trim().length !== 8}
              className="w-full bg-gray-900 text-white rounded-lg py-3 text-base font-medium disabled:opacity-50"
            >
              {isPending ? 'Joining…' : 'Join'}
            </button>
          </>
        )}

        {error && (
          <p className="text-red-600 text-sm text-center">{error}</p>
        )}
      </div>
    </main>
  )
}
