import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/auth/callback/route'

const mockExchangeCodeForSession = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: vi.fn(() =>
    Promise.resolve({
      auth: { exchangeCodeForSession: mockExchangeCodeForSession },
    })
  ),
}))

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/auth/callback')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return new NextRequest(url.toString())
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /auth/callback', () => {
  it('redirects to /recipes when code exchange succeeds', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null })

    const res = await GET(makeRequest({ code: 'valid-code' }))

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost/recipes')
  })

  it('redirects to /login?error when no code is present', async () => {
    const res = await GET(makeRequest())

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe(
      'http://localhost/login?error=Authentication+failed'
    )
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled()
  })

  it('redirects to /login?error when code exchange fails', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: { message: 'Token expired' } })

    const res = await GET(makeRequest({ code: 'expired-code' }))

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe(
      'http://localhost/login?error=Authentication+failed'
    )
  })

  it('calls exchangeCodeForSession with the code from the URL', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null })

    await GET(makeRequest({ code: 'abc-xyz' }))

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('abc-xyz')
  })
})
