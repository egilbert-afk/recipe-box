import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from '@/middleware'

const mockGetUser = vi.fn()
const mockMaybeSingle = vi.fn()

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: mockMaybeSingle,
    })),
  })),
}))

function makeRequest(pathname: string) {
  return new NextRequest(`http://localhost${pathname}`)
}

// Sets up the household membership mock for authenticated users.
function withHousehold() {
  mockMaybeSingle.mockResolvedValue({ data: { household_id: 'hh-1' }, error: null })
}

function withoutHousehold() {
  mockMaybeSingle.mockResolvedValue({ data: null, error: null })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('middleware — authenticated user with household', () => {
  it('passes through requests when a user has a household', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })
    withHousehold()

    const res = await middleware(makeRequest('/recipes'))

    expect(res.status).toBe(200)
  })

  it('passes through requests to any protected route', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })
    withHousehold()

    const res = await middleware(makeRequest('/recipes/abc-123/cook'))

    expect(res.status).toBe(200)
  })
})

describe('middleware — authenticated user without household', () => {
  it('redirects to /onboarding when user has no household', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })
    withoutHousehold()

    const res = await middleware(makeRequest('/recipes'))

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost/onboarding')
  })

  it('passes through /onboarding without redirecting (no infinite loop)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })

    const res = await middleware(makeRequest('/onboarding'))

    // Household check is skipped for /onboarding — mockMaybeSingle not called.
    expect(res.status).toBe(200)
    expect(mockMaybeSingle).not.toHaveBeenCalled()
  })

  it('passes through /auth routes without a household check', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })

    const res = await middleware(makeRequest('/auth/callback'))

    expect(res.status).toBe(200)
    expect(mockMaybeSingle).not.toHaveBeenCalled()
  })
})

describe('middleware — membership lookup fails', () => {
  it('logs the error and still redirects to /onboarding instead of failing silently', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'more than one row returned' } })

    const res = await middleware(makeRequest('/recipes'))

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost/onboarding')
    expect(consoleSpy).toHaveBeenCalledWith(
      '[middleware] household membership lookup failed:',
      { message: 'more than one row returned' }
    )
    consoleSpy.mockRestore()
  })
})

describe('middleware — unauthenticated user', () => {
  it('redirects to /login when accessing a protected route', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const res = await middleware(makeRequest('/recipes'))

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost/login')
  })

  it('passes through /login without redirecting', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const res = await middleware(makeRequest('/login'))

    expect(res.status).toBe(200)
  })

  it('passes through /signup without redirecting', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const res = await middleware(makeRequest('/signup'))

    expect(res.status).toBe(200)
  })

  it('passes through /auth routes (e.g. the callback handler)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const res = await middleware(makeRequest('/auth/callback'))

    expect(res.status).toBe(200)
  })
})
