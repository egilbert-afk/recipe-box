'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import type { Ingredient, Step } from '@/lib/types'
import { formatAmount } from '@/lib/scaler'
import { formatIngredient } from '@/lib/formatters'
import { RecipeNotes } from '@/components/RecipeNotes'

// Web Speech API types not yet in all TS DOM versions
declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance
  }
}
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  abort(): void
  onresult: ((e: SpeechRecognitionResultEvent) => void) | null
  onend: (() => void) | null
}
interface SpeechRecognitionResultEvent extends Event {
  results: { [index: number]: { [index: number]: { transcript: string } } }
}

type Props = {
  title: string
  recipeId: string
  baseServings: number
  targetServings: number
  notes: string | null
  ingredients: Ingredient[]
  steps: Step[]
  autoVoice?: boolean
}

export function CookMode({ title, recipeId, baseServings, targetServings, notes, ingredients, steps, autoVoice }: Props) {
  const [currentStep, setCurrentStep] = useState(0)
  const [ingredientsOpen, setIngredientsOpen] = useState(false)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)

  // Microstep state — fetched from the API on mount, falls back to conventional steps on error
  const [microsteps, setMicrosteps] = useState<string[] | null>(null)
  const [microstepsLoading, setMicrostepsLoading] = useState(true)
  const [microstepsError, setMicrostepsError] = useState('')

  // Voice state — only available when microsteps are loaded
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState<'idle' | 'speaking' | 'listening'>('idle')
  const [showTapPrompt, setShowTapPrompt] = useState(false)
  const voiceEnabledRef = useRef(false)
  const speakingRef = useRef(false)
  const audioStartedRef = useRef(false)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  // Refs for values accessed inside recognition event handlers (avoids stale closures)
  const activeStepsRef = useRef<string[]>([])
  const clampedStepRef = useRef(0)
  const totalStepsRef = useRef(0)

  useEffect(() => {
    fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_name: 'cooking_mode_started', properties: { recipe_id: recipeId } }),
    }).catch(() => {})
  }, [recipeId])

  useEffect(() => {
    let cancelled = false
    setMicrostepsLoading(true)
    setMicrostepsError('')
    fetch(`/api/recipes/${recipeId}/microsteps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ servings: targetServings }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        if (Array.isArray(data.steps)) {
          setMicrosteps(data.steps)
        } else if (!data.gated) {
          setMicrostepsError(data.error ?? 'Could not prepare microsteps')
        }
      })
      .catch(() => {
        if (!cancelled) setMicrostepsError('Could not prepare microsteps')
      })
      .finally(() => {
        if (!cancelled) setMicrostepsLoading(false)
      })
    return () => { cancelled = true }
  }, [recipeId, targetServings])

  useEffect(() => {
    if (!('wakeLock' in navigator)) return

    let unmounted = false

    const requestLock = async () => {
      try {
        const lock = await navigator.wakeLock.request('screen')
        if (unmounted) {
          lock.release()
          return
        }
        lock.addEventListener('release', () => { wakeLockRef.current = null })
        wakeLockRef.current = lock
      } catch {
        // Non-critical — lock may be unavailable if the page is hidden
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') requestLock()
    }

    requestLock()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      unmounted = true
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      wakeLockRef.current?.release()
      wakeLockRef.current = null
    }
  }, [])

  // Use microsteps when ready; fall back to conventional steps on error
  const activeSteps: string[] = microsteps ?? steps.map((s) => s.instruction)
  const totalSteps = activeSteps.length
  const clampedStep = Math.min(currentStep, totalSteps - 1)

  // Keep refs in sync so recognition handlers always see current values
  useEffect(() => { activeStepsRef.current = activeSteps }, [activeSteps])
  useEffect(() => { clampedStepRef.current = clampedStep }, [clampedStep])
  useEffect(() => { totalStepsRef.current = totalSteps }, [totalSteps])

  // Auto-enable voice when entering via "Read it to me" — fires once microsteps are ready
  const autoVoiceStartedRef = useRef(false)
  useEffect(() => {
    if (!autoVoice || autoVoiceStartedRef.current || microstepsLoading || !microsteps) return
    autoVoiceStartedRef.current = true
    voiceEnabledRef.current = true
    setVoiceEnabled(true)
  }, [autoVoice, microstepsLoading, microsteps])

  // On mobile browsers, speechSynthesis.speak() requires a direct user gesture.
  // When auto-enabled, the gesture (tap on "Read it to me") has expired by the time
  // microsteps load. Show a tap prompt so the user can provide a fresh gesture.
  useEffect(() => {
    if (!autoVoice || !voiceEnabled || microstepsLoading || !microsteps) return
    const timer = setTimeout(() => {
      if (!audioStartedRef.current) setShowTapPrompt(true)
    }, 800)
    return () => clearTimeout(timer)
  }, [autoVoice, voiceEnabled, microstepsLoading, microsteps])

  // Speak a step aloud, then start listening when done
  const speak = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return
    // Empty text (e.g. blank microstep) — skip TTS but keep listening
    if (!text) {
      if (voiceEnabledRef.current) {
        try { recognitionRef.current?.start(); setVoiceStatus('listening') } catch { setVoiceStatus('idle') }
      }
      return
    }
    speakingRef.current = true
    setVoiceStatus('speaking')
    try { recognitionRef.current?.abort() } catch {}
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 0.9
    const afterSpeak = () => {
      speakingRef.current = false
      if (!voiceEnabledRef.current) { setVoiceStatus('idle'); return }
      try { recognitionRef.current?.start(); setVoiceStatus('listening') }
      catch { setVoiceStatus('idle') }
    }
    u.onstart = () => { audioStartedRef.current = true; setShowTapPrompt(false) }
    u.onend = afterSpeak
    // Chrome/Android sometimes never fires onend — onerror recovers the listening loop
    u.onerror = afterSpeak
    window.speechSynthesis.speak(u)
  }, [])

  // Set up speech recognition once on mount
  useEffect(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!SR) return

    const r = new SR()
    r.continuous = false
    r.interimResults = false
    r.lang = 'en-US'

    r.onresult = (e: SpeechRecognitionResultEvent) => {
      const t = e.results[0][0].transcript.toLowerCase()
      if (t.includes('next')) {
        setCurrentStep((s) => Math.min(totalStepsRef.current - 1, s + 1))
      } else if (t.includes('back') || t.includes('previous')) {
        setCurrentStep((s) => Math.max(0, s - 1))
      } else if (t.includes('repeat')) {
        speak(activeStepsRef.current[clampedStepRef.current] ?? '')
      } else if (t.includes('ingredient')) {
        setIngredientsOpen(true)
      }
    }

    r.onend = () => {
      // Restart listening if voice is still on and TTS isn't running
      if (voiceEnabledRef.current && !speakingRef.current) {
        try { r.start(); setVoiceStatus('listening') } catch { setVoiceStatus('idle') }
      } else if (!voiceEnabledRef.current) {
        setVoiceStatus('idle')
      }
    }

    recognitionRef.current = r

    return () => {
      r.abort()
      recognitionRef.current = null
    }
  }, [speak])

  // Speak the current step whenever it changes while voice is on
  useEffect(() => {
    if (!voiceEnabled || microstepsLoading || activeSteps.length === 0) return
    speak(activeSteps[clampedStep] ?? '')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clampedStep, voiceEnabled, microstepsLoading])

  // Cleanup TTS on unmount — recognition cleanup is handled by the recognition setup effect
  useEffect(() => {
    return () => { window.speechSynthesis?.cancel() }
  }, [])

  const toggleVoice = () => {
    if (voiceEnabled) {
      // Update ref before cancel/abort so their async callbacks see the correct value
      voiceEnabledRef.current = false
      setVoiceEnabled(false)
      setVoiceStatus('idle')
      setShowTapPrompt(false)
      speakingRef.current = false
      window.speechSynthesis?.cancel()
      try { recognitionRef.current?.abort() } catch {}
    } else {
      voiceEnabledRef.current = true
      setVoiceEnabled(true)
      // No speak() here — the step-speak effect fires when voiceEnabled changes to true
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="flex items-center gap-3 px-4 py-4 border-b border-gray-200">
        <Link
          href={`/recipes/${recipeId}`}
          className="flex items-center justify-center h-12 w-12 rounded-full text-gray-600 hover:bg-gray-100"
        >
          ←
        </Link>
        <h1 className="text-lg font-semibold flex-1 truncate">{title}</h1>
      </header>

      {/* Ingredients — collapsed by default */}
      <div className="border-b border-gray-200">
        <button
          type="button"
          onClick={() => setIngredientsOpen((o) => !o)}
          aria-expanded={ingredientsOpen}
          className="flex items-center justify-between w-full px-4 py-4 text-base font-semibold text-left"
        >
          <span>
            Ingredients
            {targetServings !== baseServings && (
              <span className="ml-1 font-normal text-gray-500 text-sm">({targetServings} servings)</span>
            )}
          </span>
          <span className="text-gray-400 text-sm">{ingredientsOpen ? '▲' : '▼'}</span>
        </button>
        {ingredientsOpen && (
          <ul className="px-4 pb-4 space-y-2">
            {ingredients.map((ing) => (
              <li key={ing.id} className="text-lg text-gray-800">
                {formatIngredient(
                  ing.name,
                  formatAmount(ing.amount, baseServings, targetServings),
                  ing.unit
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Personal notes */}
      {notes && (
        <div className="px-4 pt-4">
          <RecipeNotes notes={notes} />
        </div>
      )}

      {/* Current step */}
      <main className="flex-1 flex flex-col px-4 py-6">
        {microstepsLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400">
            <p className="text-sm font-medium tracking-wide uppercase">Preparing your recipe, one action at a time…</p>
          </div>
        ) : (
          <>
            {showTapPrompt && (
              <button
                type="button"
                onClick={() => {
                  audioStartedRef.current = true
                  setShowTapPrompt(false)
                  speak(activeSteps[clampedStep] ?? '')
                }}
                className="mb-4 w-full flex items-center justify-center h-12 rounded-full bg-gray-900 text-white text-sm font-medium"
              >
                Tap to start reading aloud
              </button>
            )}
            <p className="text-sm text-gray-400 mb-4 font-medium tracking-wide uppercase">
              Step {clampedStep + 1} of {totalSteps}
              {microstepsError && <span className="ml-2 normal-case font-normal">(classic steps)</span>}
            </p>
            <p className="text-xl leading-relaxed text-gray-900">
              {activeSteps[clampedStep]}
            </p>
          </>
        )}
      </main>

      {/* Step navigation */}
      <div className="flex flex-col gap-3 px-4 py-6 border-t border-gray-200">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
            disabled={microstepsLoading || clampedStep === 0}
            className="flex-1 flex items-center justify-center h-14 rounded-full border border-gray-300 text-base font-medium disabled:opacity-30"
          >
            ← Back
          </button>
          <button
            type="button"
            onClick={() => setCurrentStep((s) => Math.min(totalSteps - 1, s + 1))}
            disabled={microstepsLoading || clampedStep === totalSteps - 1}
            className="flex-1 flex items-center justify-center h-14 rounded-full bg-black text-white text-base font-medium disabled:opacity-30"
          >
            Next →
          </button>
        </div>

        {/* Voice button — only shown when microsteps are available */}
        {microsteps && !microstepsLoading && (
          <button
            type="button"
            onClick={toggleVoice}
            className={`w-full flex items-center justify-center h-12 rounded-full text-sm font-medium transition-colors ${
              voiceEnabled
                ? 'bg-gray-900 text-white'
                : 'border border-gray-300 text-gray-600'
            }`}
          >
            {voiceEnabled
              ? voiceStatus === 'speaking' ? 'Speaking…'
              : voiceStatus === 'listening' ? 'Listening…'
              : 'Voice On'
              : 'Enable Voice'}
          </button>
        )}
      </div>
    </div>
  )
}
