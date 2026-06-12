import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { DELETE } from '@/app/api/recipes/[id]/route'

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

function authAs(userId: string) {
  mockServerClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } } }) },
  } as never)
}

function makeSelectChain(result: object) {
  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'maybeSingle']) chain[m] = vi.fn().mockReturnValue(chain)
  ;(chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue(result)
  return chain
}

// A thenable chain for delete operations (no terminal .single()/.maybeSingle())
function makeDeleteChain(deleteResult = { error: null }) {
  const chain: Record<string, unknown> = {}
  for (const m of ['delete', 'eq']) chain[m] = vi.fn().mockReturnValue(chain)
  chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(deleteResult).then(resolve, reject)
  return chain
}

function setupFrom({
  membership,
  recipe,
  finalDeleteError = null,
}: {
  membership: object | null
  recipe: object | null
  finalDeleteError?: object | null
}) {
  let recipesCallCount = 0
  mockFrom.mockImplementation((table: string) => {
    if (table === 'household_members') {
      return makeSelectChain({ data: membership, error: null }) as never
    }
    if (table === 'recipes') {
      recipesCallCount++
      if (recipesCallCount === 1) {
        return makeSelectChain({ data: recipe, error: null }) as never
      }
      return makeDeleteChain(finalDeleteError ? { error: finalDeleteError } : { error: null }) as never
    }
    return makeDeleteChain() as never
  })
}

function makeRequest(id: string) {
  return new NextRequest(`http://localhost/api/recipes/${id}`, { method: 'DELETE' })
}

beforeEach(() => {
  vi.clearAllMocks()
  authAs('user-1')
})

describe('DELETE /api/recipes/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    mockServerClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    } as never)
    const res = await DELETE(makeRequest('abc-123'), { params: Promise.resolve({ id: 'abc-123' }) })
    expect(res.status).toBe(401)
  })

  it('returns 404 when user has no household', async () => {
    setupFrom({ membership: null, recipe: null })
    const res = await DELETE(makeRequest('abc-123'), { params: Promise.resolve({ id: 'abc-123' }) })
    expect(res.status).toBe(404)
  })

  it('returns 404 when recipe is not found', async () => {
    setupFrom({ membership: { household_id: 'hh-1' }, recipe: null })
    const res = await DELETE(makeRequest('no-such-id'), { params: Promise.resolve({ id: 'no-such-id' }) })
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ error: 'Recipe not found' })
  })

  it('returns 409 when recipe is not archived', async () => {
    setupFrom({ membership: { household_id: 'hh-1' }, recipe: { id: 'abc-123', archived: false } })
    const res = await DELETE(makeRequest('abc-123'), { params: Promise.resolve({ id: 'abc-123' }) })
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ error: 'Only archived recipes can be permanently deleted' })
  })

  it('permanently deletes an archived recipe and returns 204', async () => {
    setupFrom({ membership: { household_id: 'hh-1' }, recipe: { id: 'abc-123', archived: true } })
    const res = await DELETE(makeRequest('abc-123'), { params: Promise.resolve({ id: 'abc-123' }) })
    expect(res.status).toBe(204)
  })

  it('returns 500 when the database delete fails', async () => {
    setupFrom({
      membership: { household_id: 'hh-1' },
      recipe: { id: 'abc-123', archived: true },
      finalDeleteError: { message: 'DB error' },
    })
    const res = await DELETE(makeRequest('abc-123'), { params: Promise.resolve({ id: 'abc-123' }) })
    expect(res.status).toBe(500)
  })
})
