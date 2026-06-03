import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { PATCH } from '@/app/api/recipes/[id]/route'

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

function makeChain(result?: object) {
  const chain: Record<string, unknown> = {}
  const methods = ['update', 'eq', 'select', 'single', 'maybeSingle']
  for (const m of methods) chain[m] = vi.fn().mockReturnValue(chain)
  if (result !== undefined) {
    ;(chain.single as ReturnType<typeof vi.fn>).mockResolvedValue(result)
  }
  return chain
}

function setupFrom(membershipData: object | null, otherChain?: Record<string, unknown>) {
  const shared = otherChain ?? makeChain()
  mockFrom.mockImplementation((table: string) => {
    if (table === 'household_members') {
      const m = makeChain()
      ;(m.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: membershipData, error: null,
      })
      return m as never
    }
    return shared as never
  })
  return shared
}

function makeRequest(id: string, body: object) {
  return new NextRequest(`http://localhost/api/recipes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  authAs('user-1')
  setupFrom({ household_id: 'hh-1' })
})

// ── PATCH /api/recipes/[id] — validation ──────────────────────────────────────

describe('PATCH /api/recipes/[id] — validation', () => {
  it('returns 400 when archived is not a boolean', async () => {
    const req = makeRequest('abc-123', { archived: 'yes' })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'abc-123' }) })
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'archived must be a boolean' })
  })

  it('returns 400 when archive_note exceeds 500 characters', async () => {
    const req = makeRequest('abc-123', { archived: true, archive_note: 'x'.repeat(501) })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'abc-123' }) })
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Archive note must be 500 characters or fewer' })
  })

  it('returns 400 for invalid JSON', async () => {
    const req = new NextRequest('http://localhost/api/recipes/abc-123', {
      method: 'PATCH',
      body: 'not-json',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'abc-123' }) })
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Invalid JSON' })
  })
})

// ── PATCH /api/recipes/[id] — archive ─────────────────────────────────────────

describe('PATCH /api/recipes/[id] — archive', () => {
  it('archives a recipe with a note', async () => {
    const fakeResult = { id: 'abc-123', title: 'Pasta', archived: true, archive_note: 'Too fussy' }
    setupFrom({ household_id: 'hh-1' }, makeChain({ data: fakeResult, error: null }))

    const req = makeRequest('abc-123', { archived: true, archive_note: 'Too fussy' })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'abc-123' }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ archived: true, archive_note: 'Too fussy' })
  })

  it('archives a recipe without a note', async () => {
    const fakeResult = { id: 'abc-123', title: 'Pasta', archived: true, archive_note: null }
    const chain = setupFrom({ household_id: 'hh-1' }, makeChain({ data: fakeResult, error: null }))

    const req = makeRequest('abc-123', { archived: true })
    await PATCH(req, { params: Promise.resolve({ id: 'abc-123' }) })

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ archived: true, archive_note: null })
    )
  })
})

// ── PATCH /api/recipes/[id] — restore ─────────────────────────────────────────

describe('PATCH /api/recipes/[id] — restore', () => {
  it('restores a recipe and clears the note', async () => {
    const fakeResult = { id: 'abc-123', title: 'Pasta', archived: false, archive_note: null }
    const chain = setupFrom({ household_id: 'hh-1' }, makeChain({ data: fakeResult, error: null }))

    const req = makeRequest('abc-123', { archived: false, archive_note: 'ignored' })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'abc-123' }) })

    expect(res.status).toBe(200)
    // Note is always cleared on restore regardless of what was sent
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ archived: false, archive_note: null })
    )
  })

  it('returns 404 when recipe is not found', async () => {
    setupFrom({ household_id: 'hh-1' }, makeChain({
      data: null, error: { code: 'PGRST116', message: 'Not found' },
    }))

    const req = makeRequest('nonexistent', { archived: false })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'nonexistent' }) })

    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ error: 'Recipe not found' })
  })

  it('returns 500 on database error', async () => {
    setupFrom({ household_id: 'hh-1' }, makeChain({
      data: null, error: { code: '23505', message: 'DB error' },
    }))

    const req = makeRequest('abc-123', { archived: false })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'abc-123' }) })

    expect(res.status).toBe(500)
  })
})
