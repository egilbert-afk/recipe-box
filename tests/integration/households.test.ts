import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as createHousehold } from '@/app/api/households/route'
import { POST as joinHousehold } from '@/app/api/households/join/route'
import { POST as regenerateInvite } from '@/app/api/households/invite/route'

// ── mocks ─────────────────────────────────────────────────────────────────────

// after() requires a real Next.js request-handling context that route handlers
// called directly in a unit test don't have. Run the callback immediately —
// tests only care that the right event and properties were logged, not the
// scheduling behavior itself.
vi.mock('next/server', async importOriginal => {
  const actual = await importOriginal<typeof import('next/server')>()
  return { ...actual, after: (fn: () => void | Promise<void>) => fn() }
})

vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn() },
}))

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: vi.fn(),
}))

vi.mock('@/lib/events', () => ({
  trackEvent: vi.fn(),
  VALID_EVENTS: [],
}))

import { supabase } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { trackEvent } from '@/lib/events'

const mockFrom = vi.mocked(supabase.from)
const mockServerClient = vi.mocked(createSupabaseServerClient)
const mockTrackEvent = vi.mocked(trackEvent)

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
  mockTrackEvent.mockResolvedValue(undefined)
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

  it('returns 500 and logs when the membership check itself fails, instead of treating it as no household', async () => {
    authAs('user-1')
    mockChain({ data: null, error: { message: 'more than one row returned' } })
    const res = await createHousehold(makeRequest({ name: 'The Gilberts' }))
    expect(res.status).toBe(500)
    expect(mockTrackEvent).toHaveBeenCalledWith(
      'user-1',
      null,
      'household_creation_failed',
      expect.objectContaining({ stage: 'membership_check' })
    )
  })

  it('rolls back the household and logs when the member insert fails', async () => {
    authAs('user-1')
    const fakeHousehold = { id: 'hh-new', name: 'The Gilberts', plan: 'free', is_beta: false }

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      const chain: Record<string, unknown> = {}
      const methods = ['select', 'insert', 'update', 'delete', 'eq', 'single', 'maybeSingle']
      for (const m of methods) chain[m] = vi.fn().mockReturnValue(chain)

      if (callCount === 1) {
        // Check existing membership — none
        ;(chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: null })
      } else if (callCount === 2) {
        // Insert household — succeeds
        ;(chain.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: fakeHousehold, error: null })
      } else if (callCount === 3) {
        // Insert member — fails. insert() is awaited directly here (no .select()
        // chained after it), so it must resolve rather than return the chain.
        chain.insert = vi.fn().mockResolvedValue({ error: { message: 'insert failed' } })
      } else {
        // Rollback delete
        ;(chain.eq as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: null })
      }
      return chain as never
    })

    const res = await createHousehold(makeRequest({ name: 'The Gilberts' }))
    expect(res.status).toBe(500)
    expect(mockTrackEvent).toHaveBeenCalledWith(
      'user-1',
      null,
      'household_creation_failed',
      expect.objectContaining({ stage: 'member_insert', household_id: 'hh-new' })
    )
  })

  it('returns 409 instead of 500 when the member insert loses a concurrent-create race', async () => {
    authAs('user-1')
    const fakeHousehold = { id: 'hh-new', name: 'The Gilberts', plan: 'free', is_beta: false }

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      const chain: Record<string, unknown> = {}
      const methods = ['select', 'insert', 'update', 'delete', 'eq', 'single', 'maybeSingle']
      for (const m of methods) chain[m] = vi.fn().mockReturnValue(chain)

      if (callCount === 1) {
        ;(chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: null })
      } else if (callCount === 2) {
        ;(chain.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: fakeHousehold, error: null })
      } else if (callCount === 3) {
        // A second near-simultaneous request already claimed this user_id first —
        // the UNIQUE(user_id) constraint rejects this insert as a duplicate.
        chain.insert = vi.fn().mockResolvedValue({ error: { code: '23505', message: 'duplicate key value violates unique constraint' } })
      } else {
        ;(chain.eq as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: null })
      }
      return chain as never
    })

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

  it('returns 500 and logs when the membership check itself fails, instead of treating it as no household', async () => {
    authAs('user-1')
    mockChain({ data: null, error: { message: 'more than one row returned' } })
    const res = await joinHousehold(makeRequest({ invite_code: 'ABC12345' }))
    expect(res.status).toBe(500)
    expect(mockTrackEvent).toHaveBeenCalledWith(
      'user-1',
      null,
      'household_join_failed',
      expect.objectContaining({ stage: 'membership_check' })
    )
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

  it('logs when the member insert fails after a valid invite code', async () => {
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
        chain.insert = vi.fn().mockResolvedValue({ error: { message: 'insert failed' } })
      }
      return chain as never
    })
    const res = await joinHousehold(makeRequest({ invite_code: 'ABC12345' }))
    expect(res.status).toBe(500)
    expect(mockTrackEvent).toHaveBeenCalledWith(
      'user-2',
      'hh-1',
      'household_join_failed',
      expect.objectContaining({ stage: 'member_insert' })
    )
  })

  it('returns 409 instead of 500 when the member insert loses a concurrent-join race', async () => {
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
        chain.insert = vi.fn().mockResolvedValue({ error: { code: '23505', message: 'duplicate key value violates unique constraint' } })
      }
      return chain as never
    })
    const res = await joinHousehold(makeRequest({ invite_code: 'ABC12345' }))
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ error: 'You already belong to a household' })
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
