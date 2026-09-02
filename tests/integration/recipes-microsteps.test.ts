import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/recipes/[id]/microsteps/route'

vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn() },
}))

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: vi.fn(),
}))

vi.mock('@/lib/claude', () => ({
  generateMicrosteps: vi.fn(),
}))

import { supabase } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { generateMicrosteps } from '@/lib/claude'

const mockFrom = vi.mocked(supabase.from)
const mockServerClient = vi.mocked(createSupabaseServerClient)
const mockGenerate = vi.mocked(generateMicrosteps)

// ── helpers ───────────────────────────────────────────────────────────────────

function authAs(userId: string) {
  mockServerClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } } }) },
  } as never)
}

function makeChain(maybeSingleResult?: object) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'insert', 'upsert', 'delete', 'update', 'eq', 'order', 'single', 'maybeSingle']
  for (const m of methods) chain[m] = vi.fn().mockReturnValue(chain)
  if (maybeSingleResult !== undefined) {
    ;(chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue(maybeSingleResult)
  }
  return chain
}

function setupFrom(cachedSteps: string[] | null) {
  const membershipChain = makeChain({ data: { household_id: 'hh-1' }, error: null })
  const recipesChain = makeChain({ data: { id: 'abc-123', servings: 4 }, error: null })
  const microstepsChain = makeChain({
    data: cachedSteps ? { steps: cachedSteps } : null,
    error: null,
  })
  const stepsChain = makeChain()
  ;(stepsChain.order as ReturnType<typeof vi.fn>).mockResolvedValue({
    data: [{ instruction: 'Boil pasta', order_index: 0 }],
    error: null,
  })
  const ingredientsChain = makeChain()
  ;(ingredientsChain.order as ReturnType<typeof vi.fn>).mockResolvedValue({
    data: [{ name: 'pasta', amount: 400, unit: 'g' }],
    error: null,
  })

  mockFrom.mockImplementation((table: string) => {
    if (table === 'household_members') return membershipChain as never
    if (table === 'recipes') return recipesChain as never
    if (table === 'recipe_microsteps') return microstepsChain as never
    if (table === 'steps') return stepsChain as never
    if (table === 'ingredients') return ingredientsChain as never
    return makeChain() as never
  })

  return { microstepsChain }
}

function makeRequest(id: string, body: object) {
  return new NextRequest(`http://localhost/api/recipes/${id}/microsteps`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  authAs('user-1')
  mockGenerate.mockResolvedValue(['Fresh step one', 'Fresh step two'])
})

describe('POST /api/recipes/[id]/microsteps — cache behavior', () => {
  it('returns cached steps without regenerating when regenerate is not set', async () => {
    setupFrom(['Cached step one'])
    const req = makeRequest('abc-123', { servings: 4 })
    const res = await POST(req, { params: Promise.resolve({ id: 'abc-123' }) })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ steps: ['Cached step one'] })
    expect(mockGenerate).not.toHaveBeenCalled()
  })

  it('bypasses the cache and regenerates when regenerate is true', async () => {
    const { microstepsChain } = setupFrom(['Stale cached step'])
    const req = makeRequest('abc-123', { servings: 4, regenerate: true })
    const res = await POST(req, { params: Promise.resolve({ id: 'abc-123' }) })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ steps: ['Fresh step one', 'Fresh step two'] })
    expect(mockGenerate).toHaveBeenCalled()
    expect(microstepsChain.upsert).toHaveBeenCalledWith(
      { recipe_id: 'abc-123', servings: 4, steps: ['Fresh step one', 'Fresh step two'] },
      { onConflict: 'recipe_id,servings' }
    )
  })

  it('generates and caches fresh steps when nothing is cached yet', async () => {
    setupFrom(null)
    const req = makeRequest('abc-123', { servings: 4 })
    const res = await POST(req, { params: Promise.resolve({ id: 'abc-123' }) })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ steps: ['Fresh step one', 'Fresh step two'] })
    expect(mockGenerate).toHaveBeenCalled()
  })
})
