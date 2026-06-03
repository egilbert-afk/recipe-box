import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from '@/middleware'

const mockGetUser = vi.fn()

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}))

function makeRequest(pathname: string) {
  return new NextRequest(`http://localhost${pathname}`)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('middleware — authenticated user', () => {
  it('passes through requests when a user is present', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })

    const res = await middleware(makeRequest('/recipes'))

    expect(res.status).toBe(200)
  })

  it('passes through requests to any protected route', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })

    const res = await middleware(makeRequest('/recipes/abc-123/cook'))

    expect(res.status).toBe(200)
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

  it('passes through /auth routes (e.g. the callback handler)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const res = await middleware(makeRequest('/auth/callback'))

    expect(res.status).toBe(200)
  })
})
