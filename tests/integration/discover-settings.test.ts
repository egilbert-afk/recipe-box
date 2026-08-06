import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { PATCH as patchHousehold } from '@/app/api/households/route'

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

const mockFrom = vi.mocked(supabase.from)
const mockServerClient = vi.mocked(createSupabaseServerClient)

function authAs(userId: string) {
  mockServerClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } } }) },
  } as never)
}

function makePatchRequest(body: object) {
  return new NextRequest('http://localhost/api/households', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function setupPatch({
  membership = { household_id: 'hh-1' } as object | null,
  updateError = null as object | null,
} = {}) {
  let callCount = 0
  mockFrom.mockImplementation(() => {
    callCount++
    const chain: Record<string, unknown> = {}
    const methods = ['select', 'update', 'eq', 'maybeSingle', 'single']
    for (const m of methods) chain[m] = vi.fn().mockReturnValue(chain)
    if (callCount === 1) {
      ;(chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: membership, error: null,
      })
    } else {
      chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve({ error: updateError }).then(resolve, reject)
    }
    return chain as never
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  authAs('user-1')
})

describe('PATCH /api/households — discover_opt_out', () => {
  it('returns 401 when not authenticated', async () => {
    mockServerClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    } as never)
    const res = await patchHousehold(makePatchRequest({ discover_opt_out: true }))
    expect(res.status).toBe(401)
  })

  it('returns 404 when user has no household', async () => {
    setupPatch({ membership: null })
    const res = await patchHousehold(makePatchRequest({ discover_opt_out: true }))
    expect(res.status).toBe(404)
  })

  it('returns 400 when discover_opt_out is not a boolean', async () => {
    setupPatch()
    const res = await patchHousehold(makePatchRequest({ discover_opt_out: 'yes' }))
    expect(res.status).toBe(400)
  })

  it('returns 200 when opting out', async () => {
    setupPatch()
    const res = await patchHousehold(makePatchRequest({ discover_opt_out: true }))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true })
  })

  it('returns 200 when opting back in', async () => {
    setupPatch()
    const res = await patchHousehold(makePatchRequest({ discover_opt_out: false }))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true })
  })

  it('returns 500 when the DB update fails', async () => {
    setupPatch({ updateError: { message: 'connection error' } })
    const res = await patchHousehold(makePatchRequest({ discover_opt_out: true }))
    expect(res.status).toBe(500)
  })
})
