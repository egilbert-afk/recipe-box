'use client'
import { useState, useEffect } from 'react'

export function InviteCode({ code, kitchenName }: { code: string; kitchenName: string }) {
  const [copied, setCopied] = useState(false)
  const [joinUrl, setJoinUrl] = useState('')

  useEffect(() => {
    setJoinUrl(`${window.location.origin}/join?code=${code}`)
  }, [code])
  const shareText = `Join my kitchen "${kitchenName}" on Mise and cook together!`

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Join my kitchen on Mise', text: shareText, url: joinUrl })
      } catch {
        // User dismissed the share sheet — no action needed
      }
    } else {
      await copyLink()
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(joinUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard unavailable
    }
  }

  const mailtoHref = `mailto:?subject=${encodeURIComponent(`Join my kitchen on Mise`)}&body=${encodeURIComponent(`${shareText}\n\nClick here to join:\n${joinUrl}`)}`

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">
        Invite someone to cook with you. They'll get a link that takes them straight in.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleShare}
          className="flex-1 h-12 bg-gray-900 text-white rounded-xl text-sm font-medium"
        >
          {copied ? 'Link copied!' : 'Share invite'}
        </button>
        <a
          href={mailtoHref}
          className="flex-1 h-12 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 flex items-center justify-center"
        >
          Email invite
        </a>
      </div>
    </div>
  )
}
