import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as createHousehold } from '@/app/api/households/route'
import { GET as getMyHousehold } from '@/app/api/households/me/route'
import { POST as joinHousehold } from '@/app/api/households/join/route'
import { POST as regenerateInvite } from '@/app/api/households/invite/route'

// ── mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn() },
}))

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: vi.fn(),
}))

import { supabase } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'

const mockFrom = vi.mocked(supabase.from)
const mockServerClient = vi.mocked(createSupabaseServerClient)

// ── helpers ───────────────────────────────────────────────────────────────────

function authAs(userId: string) {
  mockServerClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } } }) },
  } as never)
}

function makeRequest(body: object) {
  return new NextRequest('http://localhost', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

// Builds a chainable Supabase mock that resolves with the given result at the
// end of the chain. Supports the call patterns used across all four routes.
function mockChain(result: object) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'single', 'maybeSingle']
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  ;(chain.single as ReturnType<typeof vi.fn>).mockResolvedValue(result)
  ;(chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue(result)
  mockFrom.mockReturnValue(chain as never)
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── POST /api/households ──────────────────────────────────────────────────────

describe('POST /api/households', () => {
  it('returns 400 when name is missing', async () => {
    authAs('user-1')
    const res = await createHousehold(makeRequest({}))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Household name is required' })
  })

  it('returns 400 when name exceeds 100 characters', async () => {
    authAs('user-1')
    const res = await createHousehold(makeRequest({ name: 'x'.repeat(101) }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Household name must be 100 characters or fewer' })
  })

  it('returns 409 when user already belongs to a household', async () => {
    authAs('user-1')
    mockChain({ data: { household_id: 'hh-1' }, error: null })
    const res = await createHousehold(makeRequest({ name: 'The Gilberts' }))
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ error: 'You already belong to a household' })
  })

  it('creates a household and returns 201', async () => {
    authAs('user-1')
    const fakeHousehold = { id: 'hh-new', name: 'The Gilberts', plan: 'free', is_beta: false }

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      const chain: Record<string, unknown> = {}
      const methods = ['select', 'insert', 'update', 'delete', 'eq', 'single', 'maybeSingle']
      for (const m of methods) chain[m] = vi.fn().mockReturnValue(chain)

      if (callCount === 1) {
        // Check existing membership — returns null (no household)
        ;(chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: null })
      } else if (callCount === 2) {
        // Insert household
        ;(chain.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: fakeHousehold, error: null })
      } else {
        // Insert member
        ;(chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: null })
        ;(chain.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: null })
      }
      return chain as never
    })

    const res = await createHousehold(makeRequest({ name: 'The Gilberts' }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toMatchObject({ name: 'The Gilberts' })
  })
})

// ── GET /api/households/me ────────────────────────────────────────────────────

describe('GET /api/households/me', () => {
  it('returns 404 when user has no household', async () => {
    authAs('user-1')
    mockChain({ data: null, error: null })
    const res = await getMyHousehold()
    expect(res.status).toBe(404)
  })

  it('returns household and members for authenticated user', async () => {
    authAs('user-1')
    const fakeHousehold = { id: 'hh-1', name: 'Gilbert Household', plan: 'free', is_beta: true, invite_code: 'ABC12345' }
    const fakeMembers = [{ user_id: 'user-1', role: 'owner', joined_at: '2026-01-01' }]

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      const chain: Record<string, unknown> = {}
      const methods = ['select', 'eq', 'single', 'maybeSingle']
      for (const m of methods) chain[m] = vi.fn().mockReturnValue(chain)

      if (callCount === 1) {
        ;(chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { household_id: 'hh-1', role: 'owner' }, error: null })
      } else if (callCount === 2) {
        ;(chain.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: fakeHousehold, error: null })
      } else {
        ;(chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({ data: fakeMembers, error: null })
        ;(chain.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: fakeMembers, error: null })
      }
      return chain as never
    })

    const res = await getMyHousehold()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ name: 'Gilbert Household' })
  })

  it('hides invite code from non-owners', async () => {
    authAs('user-2')
    const fakeHousehold = { id: 'hh-1', name: 'Gilbert Household', plan: 'free', is_beta: true, invite_code: 'SECRET1' }

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      const chain: Record<string, unknown> = {}
      const methods = ['select', 'eq', 'single', 'maybeSingle']
      for (const m of methods) chain[m] = vi.fn().mockReturnValue(chain)

      if (callCount === 1) {
        ;(chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { household_id: 'hh-1', role: 'member' }, error: null })
      } else if (callCount === 2) {
        ;(chain.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: fakeHousehold, error: null })
      } else {
        ;(chain.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [], error: null })
        ;(chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [], error: null })
      }
      return chain as never
    })

    const res = await getMyHousehold()
    const body = await res.json()
    expect(body.invite_code).toBeUndefined()
  })
})

// ── POST /api/households/join ─────────────────────────────────────────────────

describe('POST /api/households/join', () => {
  it('returns 400 when invite code is missing', async () => {
    authAs('user-1')
    const res = await joinHousehold(makeRequest({}))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Invite code is required' })
  })

  it('returns 409 when user already belongs to a household', async () => {
    authAs('user-1')
    mockChain({ data: { household_id: 'hh-1' }, error: null })
    const res = await joinHousehold(makeRequest({ invite_code: 'ABC12345' }))
    expect(res.status).toBe(409)
  })

  it('returns 404 when invite code does not match any household', async () => {
    authAs('user-1')
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      const chain: Record<string, unknown> = {}
      const methods = ['select', 'insert', 'eq', 'single', 'maybeSingle']
      for (const m of methods) chain[m] = vi.fn().mockReturnValue(chain)
      if (callCount === 1) {
        ;(chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: null })
      } else {
        ;(chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: null })
      }
      return chain as never
    })
    const res = await joinHousehold(makeRequest({ invite_code: 'INVALID1' }))
    expect(res.status).toBe(404)
  })

  it('joins a household and returns 200', async () => {
    authAs('user-2')
    const fakeHousehold = { id: 'hh-1', name: 'Gilbert Household', plan: 'free', is_beta: true }
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      const chain: Record<string, unknown> = {}
      const methods = ['select', 'insert', 'eq', 'single', 'maybeSingle']
      for (const m of methods) chain[m] = vi.fn().mockReturnValue(chain)
      if (callCount === 1) {
        ;(chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: null })
      } else if (callCount === 2) {
        ;(chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({ data: fakeHousehold, error: null })
      } else {
        ;(chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: null })
        ;(chain.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: null })
      }
      return chain as never
    })
    const res = await joinHousehold(makeRequest({ invite_code: 'ABC12345' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ name: 'Gilbert Household' })
  })
})

// ── POST /api/households/invite ───────────────────────────────────────────────

describe('POST /api/households/invite', () => {
  it('returns 404 when user has no household', async () => {
    authAs('user-1')
    mockChain({ data: null, error: null })
    const res = await regenerateInvite()
    expect(res.status).toBe(404)
  })

  it('returns 403 when user is not the owner', async () => {
    authAs('user-2')
    mockChain({ data: { household_id: 'hh-1', role: 'member' }, error: null })
    const res = await regenerateInvite()
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ error: 'Only the household owner can regenerate the invite code' })
  })

  it('returns a new invite code for the owner', async () => {
    authAs('user-1')
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      const chain: Record<string, unknown> = {}
      const methods = ['select', 'update', 'eq', 'single', 'maybeSingle']
      for (const m of methods) chain[m] = vi.fn().mockReturnValue(chain)
      if (callCount === 1) {
        ;(chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { household_id: 'hh-1', role: 'owner' }, error: null })
      } else {
        ;(chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: null })
        ;(chain.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: null })
      }
      return chain as never
    })
    const res = await regenerateInvite()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.invite_code).toMatch(/^[0-9A-F]{8}$/)
  })
})
