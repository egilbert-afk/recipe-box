import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/auth/callback/route'

const mockExchangeCodeForSession = vi.fn()

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: { exchangeCodeForSession: mockExchangeCodeForSession },
  })),
}))

vi.mock('@/lib/events', () => ({
  trackEvent: vi.fn(),
  VALID_EVENTS: [],
}))

import { trackEvent } from '@/lib/events'
const mockTrackEvent = vi.mocked(trackEvent)

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/auth/callback')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return new NextRequest(url.toString())
}

beforeEach(() => {
  vi.clearAllMocks()
  mockTrackEvent.mockResolvedValue(undefined)
})

describe('GET /auth/callback', () => {
  it('redirects to /recipes when code exchange succeeds with no invite/save/recovery context', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })

    const res = await GET(makeRequest({ code: 'valid-code' }))

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost/recipes')
  })

  it('redirects to /login?error when no code is present', async () => {
    const res = await GET(makeRequest())

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe(
      'http://localhost/login?error=That+sign-in+link+has+expired.+Try+signing+in+again.'
    )
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled()
  })

  it('redirects to /login?error when code exchange fails', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ data: { user: null }, error: { message: 'Token expired' } })

    const res = await GET(makeRequest({ code: 'expired-code' }))

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe(
      'http://localhost/login?error=That+sign-in+link+has+expired.+Try+signing+in+again.'
    )
  })

  it('calls exchangeCodeForSession with the code from the URL', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })

    await GET(makeRequest({ code: 'abc-xyz' }))

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('abc-xyz')
  })

  it('redirects to /reset-password when type is recovery', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })

    const res = await GET(makeRequest({ code: 'valid-code', type: 'recovery' }))

    expect(res.headers.get('location')).toBe('http://localhost/reset-password')
  })

  it('redirects to /onboarding with the invite code when one is present', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })

    const res = await GET(makeRequest({ code: 'valid-code', invite_code: 'ABCD1234' }))

    expect(res.headers.get('location')).toBe('http://localhost/onboarding?code=ABCD1234')
  })

  it('tracks account_created for a signup confirmation', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })

    await GET(makeRequest({ code: 'valid-code', type: 'signup' }))

    expect(mockTrackEvent).toHaveBeenCalledWith('user-1', null, 'account_created')
  })

  it('tracks account_created for a brand-new Google sign-in (first sign-in ever)', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: { user: { id: 'user-1', created_at: '2026-09-02T00:00:00Z', last_sign_in_at: '2026-09-02T00:00:00Z' } },
      error: null,
    })

    await GET(makeRequest({ code: 'valid-code', type: 'oauth' }))

    expect(mockTrackEvent).toHaveBeenCalledWith('user-1', null, 'account_created')
  })

  it('does not track account_created for a returning Google sign-in', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: { user: { id: 'user-1', created_at: '2026-01-01T00:00:00Z', last_sign_in_at: '2026-09-02T00:00:00Z' } },
      error: null,
    })

    await GET(makeRequest({ code: 'valid-code', type: 'oauth' }))

    expect(mockTrackEvent).not.toHaveBeenCalled()
  })

  it('still treats a first Google sign-in as new when the timestamps differ by a couple seconds', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: { user: { id: 'user-1', created_at: '2026-09-02T00:00:00.000Z', last_sign_in_at: '2026-09-02T00:00:02.000Z' } },
      error: null,
    })

    await GET(makeRequest({ code: 'valid-code', type: 'oauth' }))

    expect(mockTrackEvent).toHaveBeenCalledWith('user-1', null, 'account_created')
  })

  it('redirects with an honest cancelled message when Google returns access_denied', async () => {
    const res = await GET(makeRequest({ error: 'access_denied' }))

    expect(res.headers.get('location')).toBe('http://localhost/login?error=Google+sign-in+was+cancelled.')
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled()
  })

  it('redirects with a generic Google failure message for other OAuth errors', async () => {
    const res = await GET(makeRequest({ error: 'server_error' }))

    expect(res.headers.get('location')).toBe('http://localhost/login?error=Google+sign-in+failed.+Please+try+again.')
  })
})
