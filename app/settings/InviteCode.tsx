'use client'
import { useState, useEffect } from 'react'

export function InviteCode({ code, kitchenName }: { code: string; kitchenName: string }) {
  const [copied, setCopied] = useState(false)
  const [joinUrl, setJoinUrl] = useState('')

  useEffect(() => {
    setJoinUrl(`${window.location.origin}/join?code=${code}`)
  }, [code])

  const shareTitle = `Join ${kitchenName} on Recipe Box`
  const shareText = `I'd like you to join ${kitchenName}. It's where we keep all our family recipes. Tap the link to join.`
  const emailBody = `I'd like you to join ${kitchenName} on Recipe Box, a shared collection of our family recipes.\n\nClick the link below to join:\n${joinUrl}`

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title: shareTitle, text: shareText, url: joinUrl })
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

  const mailtoHref = `mailto:?subject=${encodeURIComponent(shareTitle)}&body=${encodeURIComponent(emailBody)}`

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">
        Send someone a link to join your kitchen. They'll be added automatically when they sign up.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleShare}
          className="flex-1 h-12 bg-gray-900 text-white rounded-xl text-sm font-medium"
        >
          {copied ? 'Link copied!' : 'Share link'}
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
