import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/share/[token]/save/route'

vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn() },
}))

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: vi.fn(),
}))

vi.mock('@/lib/events', () => ({
  trackEvent: vi.fn().mockResolvedValue(undefined),
}))

import { supabase } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { trackEvent } from '@/lib/events'

const mockFrom = vi.mocked(supabase.from)
const mockServerClient = vi.mocked(createSupabaseServerClient)

// ── helpers ───────────────────────────────────────────────────────────────────

function authAs(userId: string) {
  mockServerClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } } }) },
  } as never)
}

// select chain ending in .maybeSingle() — for single-row lookups
function makeSelectSingle(result: object) {
  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'maybeSingle']) chain[m] = vi.fn().mockReturnValue(chain)
  ;(chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue(result)
  return chain
}

// select chain ending in .order() — for list fetches (ingredients, steps)
function makeSelectList(result: object) {
  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'eq']) chain[m] = vi.fn().mockReturnValue(chain)
  chain.order = vi.fn().mockResolvedValue(result)
  return chain
}

// insert chain ending in .select().single() — for recipe clone insert
function makeInsertSingle(result: object) {
  const chain: Record<string, unknown> = {}
  for (const m of ['insert', 'select', 'single']) chain[m] = vi.fn().mockReturnValue(chain)
  ;(chain.single as ReturnType<typeof vi.fn>).mockResolvedValue(result)
  return chain
}

// thenable chain for insert/delete with no terminal method
function makeWriteChain(result = { error: null }) {
  const chain: Record<string, unknown> = {}
  for (const m of ['insert', 'delete', 'eq']) chain[m] = vi.fn().mockReturnValue(chain)
  chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject)
  return chain
}

// ── fixtures ──────────────────────────────────────────────────────────────────

const SOURCE = {
  id: 'src-1',
  title: 'Pasta Carbonara',
  cuisine_id: 'italian',
  meal_type_id: 'dinner',
  servings: 4,
  source_url: null,
  notes: null,
}
const INGREDIENTS = [{ name: 'eggs', amount: 4, unit: null, order_index: 0 }]
const STEPS = [{ instruction: 'Boil water', order_index: 0 }]

function setupFrom({
  membership = { household_id: 'hh-1' },
  source = SOURCE as object | null,
  ingredients = INGREDIENTS as object[],
  steps = STEPS as object[],
  cloneResult = { data: { id: 'clone-1' }, error: null } as object,
  cloneInsertChain = undefined as Record<string, unknown> | undefined,
  ingredientInsertError = null as object | null,
  stepInsertError = null as object | null,
} = {}) {
  // Track per-table call counts so the same table can serve different roles
  // across multiple calls (e.g. recipes: lookup → insert → rollback delete).
  const counts = { recipes: 0, ingredients: 0, steps: 0 }
  // Populated during route execution when the handler issues its rollback delete.
  const rollback = { chain: null as Record<string, unknown> | null }

  mockFrom.mockImplementation((table: string) => {
    if (table === 'household_members') {
      return makeSelectSingle({ data: membership, error: null }) as never
    }
    if (table === 'recipes') {
      counts.recipes++
      if (counts.recipes === 1) return makeSelectSingle({ data: source, error: null }) as never
      if (counts.recipes === 2) return (cloneInsertChain ?? makeInsertSingle(cloneResult)) as never
      rollback.chain = makeWriteChain()
      return rollback.chain as never // absorbs the rollback DELETE issued by the handler
    }
    if (table === 'ingredients') {
      counts.ingredients++
      if (counts.ingredients === 1) return makeSelectList({ data: ingredients, error: null }) as never
      return makeWriteChain(ingredientInsertError ? { error: ingredientInsertError } : { error: null }) as never
    }
    if (table === 'steps') {
      counts.steps++
      if (counts.steps === 1) return makeSelectList({ data: steps, error: null }) as never
      return makeWriteChain(stepInsertError ? { error: stepInsertError } : { error: null }) as never
    }
    return makeWriteChain() as never
  })

  return { counts, rollback }
}

function makeRequest(token: string) {
  return new NextRequest(`http://localhost/api/share/${token}/save`, { method: 'POST' })
}

beforeEach(() => {
  vi.clearAllMocks()
  authAs('user-1')
})

// ── tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/share/[token]/save', () => {
  it('returns 401 when not authenticated', async () => {
    mockServerClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    } as never)
    const res = await POST(makeRequest('some-token'), { params: Promise.resolve({ token: 'some-token' }) })
    expect(res.status).toBe(401)
  })

  it('returns 403 when user has no household', async () => {
    setupFrom({ membership: null })
    const res = await POST(makeRequest('some-token'), { params: Promise.resolve({ token: 'some-token' }) })
    expect(res.status).toBe(403)
  })

  it('returns 404 when share token is not found', async () => {
    setupFrom({ source: null })
    const res = await POST(makeRequest('bad-token'), { params: Promise.resolve({ token: 'bad-token' }) })
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ error: 'Recipe not found' })
  })

  it('clones the recipe and returns 201 with the new recipe id', async () => {
    setupFrom()
    const res = await POST(makeRequest('abc'), { params: Promise.resolve({ token: 'abc' }) })
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ recipe_id: 'clone-1' })
  })

  it('clones a recipe that has no ingredients or steps without error', async () => {
    setupFrom({ ingredients: [], steps: [] })
    const res = await POST(makeRequest('abc'), { params: Promise.resolve({ token: 'abc' }) })
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ recipe_id: 'clone-1' })
  })

  it('returns 500 when the recipe clone insert fails', async () => {
    setupFrom({ cloneResult: { data: null, error: { message: 'DB error' } } })
    const res = await POST(makeRequest('abc'), { params: Promise.resolve({ token: 'abc' }) })
    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({ error: 'Failed to save recipe' })
  })

  it('returns 500 and rolls back the orphaned recipe when ingredient insert fails', async () => {
    const { counts, rollback } = setupFrom({ ingredientInsertError: { message: 'DB error' } })
    const res = await POST(makeRequest('abc'), { params: Promise.resolve({ token: 'abc' }) })
    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({ error: 'Failed to save recipe' })
    expect(counts.recipes).toBe(3) // lookup + insert + rollback delete
    expect(rollback.chain?.delete).toHaveBeenCalled()
  })

  it('returns 500 and rolls back the orphaned recipe when step insert fails', async () => {
    const { counts, rollback } = setupFrom({ stepInsertError: { message: 'DB error' } })
    const res = await POST(makeRequest('abc'), { params: Promise.resolve({ token: 'abc' }) })
    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({ error: 'Failed to save recipe' })
    expect(counts.recipes).toBe(3) // lookup + insert + rollback delete
    expect(rollback.chain?.delete).toHaveBeenCalled()
  })

  it('does not copy share_token to the cloned recipe', async () => {
    const cloneChain = makeInsertSingle({ data: { id: 'clone-1' }, error: null })
    setupFrom({ cloneInsertChain: cloneChain })
    await POST(makeRequest('abc'), { params: Promise.resolve({ token: 'abc' }) })
    const insertArg = (cloneChain.insert as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(insertArg).not.toHaveProperty('share_token')
  })

  it('returns 201 even when trackEvent throws', async () => {
    vi.mocked(trackEvent).mockRejectedValueOnce(new Error('analytics down'))
    setupFrom()
    const res = await POST(makeRequest('abc'), { params: Promise.resolve({ token: 'abc' }) })
    expect(res.status).toBe(201)
  })

  it('returns 500 when the recipe clone returns null data with no error', async () => {
    setupFrom({ cloneResult: { data: null, error: null } })
    const res = await POST(makeRequest('abc'), { params: Promise.resolve({ token: 'abc' }) })
    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({ error: 'Failed to save recipe' })
  })
})
