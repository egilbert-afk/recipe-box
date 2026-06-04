'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'

export default function FeedbackButton() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  // Suppress in cooking mode — the fixed button would overlap the Next step button
  if (pathname?.endsWith('/cook')) return null

  async function submit() {
    if (!message.trim()) return
    setStatus('sending')
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
      if (!res.ok) {
        setStatus('error')
        return
      }
      setStatus('sent')
      setMessage('')
      setTimeout(() => {
        setOpen(false)
        setStatus('idle')
      }, 1500)
    } catch {
      setStatus('error')
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-4 z-40 bg-gray-800 text-white text-sm px-4 py-2 rounded-full shadow-lg active:opacity-80"
        aria-label="Send feedback"
      >
        Feedback
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40"
          onClick={(e) => { if (e.target === e.currentTarget) { setOpen(false); setStatus('idle') } }}
        >
          <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-6 space-y-4 shadow-xl">
            <h2 className="text-lg font-semibold">Send feedback</h2>
            <p className="text-sm text-gray-500">
              What&apos;s working, what&apos;s broken, what you wish it did.
            </p>

            {status === 'sent' ? (
              <p className="text-green-600 font-medium py-4 text-center">Thanks — got it!</p>
            ) : (
              <>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Your feedback…"
                  rows={5}
                  maxLength={1000}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-300"
                />
                {status === 'error' && (
                  <p className="text-red-500 text-sm">Something went wrong — try again.</p>
                )}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setOpen(false); setStatus('idle') }}
                    className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium active:opacity-70"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={status === 'sending' || !message.trim()}
                    className="flex-1 py-3 rounded-xl bg-gray-800 text-white text-sm font-medium disabled:opacity-40 active:opacity-80"
                  >
                    {status === 'sending' ? 'Sending…' : 'Send'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
