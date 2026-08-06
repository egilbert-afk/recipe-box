import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/discover/route'
import { POST as addRecipe } from '@/app/api/discover/add/route'
import { POST as dismiss } from '@/app/api/discover/dismiss/route'

vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}))

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: vi.fn(),
}))

vi.mock('@/lib/events', () => ({
  trackEvent: vi.fn().mockResolvedValue(undefined),
  VALID_EVENTS: [],
}))

import { supabase } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'

const mockFrom = vi.mocked(supabase.from)
const mockRpc  = vi.mocked(supabase.rpc)
const mockServerClient = vi.mocked(createSupabaseServerClient)

// ── helpers ───────────────────────────────────────────────────────────────────

function authAs(userId: string) {
  mockServerClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } } }) },
  } as never)
}

function makeSelectSingle(result: object) {
  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'maybeSingle']) chain[m] = vi.fn().mockReturnValue(chain)
  ;(chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue(result)
  return chain
}

function makeSelectList(result: object) {
  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'eq']) chain[m] = vi.fn().mockReturnValue(chain)
  chain.order = vi.fn().mockResolvedValue(result)
  return chain
}

function makeSelectListError(error: object) {
  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'eq']) chain[m] = vi.fn().mockReturnValue(chain)
  chain.order = vi.fn().mockResolvedValue({ data: null, error })
  return chain
}

// Simulates .select('*', { count: 'exact', head: true }).eq().eq().gte()
function makeCountChain(count: number) {
  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'gte']) chain[m] = vi.fn().mockReturnValue(chain)
  chain.then = (resolve: (v: unknown) => unknown, _reject?: (e: unknown) => unknown) =>
    Promise.resolve({ count, error: null }).then(resolve)
  return chain
}

function makeInsertSingle(result: object) {
  const chain: Record<string, unknown> = {}
  for (const m of ['insert', 'select', 'single']) chain[m] = vi.fn().mockReturnValue(chain)
  ;(chain.single as ReturnType<typeof vi.fn>).mockResolvedValue(result)
  return chain
}

function makeWriteChain(result = { error: null }) {
  const chain: Record<string, unknown> = {}
  for (const m of ['insert', 'delete', 'eq']) chain[m] = vi.fn().mockReturnValue(chain)
  chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject)
  return chain
}

const MEMBERSHIP = { household_id: 'hh-1' }

const POOL_RECIPE = {
  id: 'pool-1',
  title: 'Lemon Pasta',
  source_url: 'https://seriouseats.com/lemon-pasta',
  cuisine_id: 'italian',
  meal_type_id: 'entree',
  servings: 4,
}

const INGREDIENTS = [{ name: 'pasta', amount: 400, unit: 'g', order_index: 0 }]
const STEPS = [{ instruction: 'Boil water', order_index: 0 }]

beforeEach(() => {
  vi.clearAllMocks()
  authAs('user-1')
})

// ── GET /api/discover ─────────────────────────────────────────────────────────

describe('GET /api/discover', () => {
  function setupDiscover({
    membership = MEMBERSHIP as object | null,
    rpcRows = [POOL_RECIPE] as object[],
    rpcError = null as object | null,
    ingredients = INGREDIENTS as object[],
    steps = STEPS as object[],
    ingError = null as object | null,
    stepError = null as object | null,
  } = {}) {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'household_members') {
        return makeSelectSingle({ data: membership, error: null }) as never
      }
      if (table === 'ingredients') {
        return ingError
          ? makeSelectListError(ingError) as never
          : makeSelectList({ data: ingredients, error: null }) as never
      }
      if (table === 'steps') {
        return stepError
          ? makeSelectListError(stepError) as never
          : makeSelectList({ data: steps, error: null }) as never
      }
      return makeWriteChain() as never
    })
    mockRpc.mockResolvedValue({ data: rpcRows, error: rpcError } as never)
  }

  it('returns 401 when not authenticated', async () => {
    mockServerClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    } as never)
    const req = new NextRequest('http://localhost/api/discover')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns 403 when user has no household', async () => {
    setupDiscover({ membership: null })
    const req = new NextRequest('http://localhost/api/discover')
    const res = await GET(req)
    expect(res.status).toBe(403)
  })

  it('returns empty:true when the pool is empty', async () => {
    setupDiscover({ rpcRows: [] })
    const req = new NextRequest('http://localhost/api/discover')
    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ empty: true })
  })

  it('returns a card with ingredients and steps', async () => {
    setupDiscover()
    const req = new NextRequest('http://localhost/api/discover')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.card).toMatchObject({
      id: 'pool-1',
      title: 'Lemon Pasta',
      source_url: 'https://seriouseats.com/lemon-pasta',
      cuisine_id: 'italian',
      meal_type_id: 'entree',
      servings: 4,
    })
    expect(body.card.ingredients).toHaveLength(1)
    expect(body.card.steps).toHaveLength(1)
  })

  it('passes cuisine_id and meal_type_id filters to the RPC', async () => {
    setupDiscover()
    const req = new NextRequest('http://localhost/api/discover?cuisine_id=italian&meal_type_id=entree')
    await GET(req)
    expect(mockRpc).toHaveBeenCalledWith('discover_next_recipe', {
      p_household_id: 'hh-1',
      p_cuisine_id: 'italian',
      p_meal_type_id: 'entree',
    })
  })

  it('passes null filters when no query params provided', async () => {
    setupDiscover()
    const req = new NextRequest('http://localhost/api/discover')
    await GET(req)
    expect(mockRpc).toHaveBeenCalledWith('discover_next_recipe', {
      p_household_id: 'hh-1',
      p_cuisine_id: null,
      p_meal_type_id: null,
    })
  })

  it('returns 500 when the RPC errors', async () => {
    setupDiscover({ rpcError: { message: 'DB error' } })
    const req = new NextRequest('http://localhost/api/discover')
    const res = await GET(req)
    expect(res.status).toBe(500)
  })

  it('returns 500 when the ingredient fetch errors', async () => {
    setupDiscover({ ingError: { message: 'DB error' } })
    const req = new NextRequest('http://localhost/api/discover')
    const res = await GET(req)
    expect(res.status).toBe(500)
  })

  it('returns 500 when the step fetch errors', async () => {
    setupDiscover({ stepError: { message: 'DB error' } })
    const req = new NextRequest('http://localhost/api/discover')
    const res = await GET(req)
    expect(res.status).toBe(500)
  })
})

// ── POST /api/discover/add ────────────────────────────────────────────────────

describe('POST /api/discover/add', () => {
  function setupAdd({
    membership = MEMBERSHIP as object | null,
    recentAddCount = 0,
    source = {
      id: 'pool-1',
      title: 'Lemon Pasta',
      cuisine_id: 'italian',
      meal_type_id: 'entree',
      servings: 4,
      source_url: 'https://seriouseats.com/lemon-pasta',
      notes: null,
    } as object | null,
    ingredients = INGREDIENTS as object[],
    steps = STEPS as object[],
    cloneResult = { data: { id: 'clone-1' }, error: null } as object,
    cloneInsertChain = undefined as Record<string, unknown> | undefined,
    ingredientInsertError = null as object | null,
    stepInsertError = null as object | null,
  } = {}) {
    const counts = { recipes: 0 }
    const rollback = { chain: null as Record<string, unknown> | null }

    mockFrom.mockImplementation((table: string) => {
      if (table === 'household_members') {
        return makeSelectSingle({ data: membership, error: null }) as never
      }
      if (table === 'recipes') {
        counts.recipes++
        if (counts.recipes === 1) return makeCountChain(recentAddCount) as never  // rate limit check
        if (counts.recipes === 2) return makeSelectSingle({ data: source, error: null }) as never
        if (counts.recipes === 3) return (cloneInsertChain ?? makeInsertSingle(cloneResult)) as never
        rollback.chain = makeWriteChain()
        return rollback.chain as never
      }
      if (table === 'ingredients') {
        if (mockFrom.mock.calls.filter((c) => c[0] === 'ingredients').length === 1) {
          return makeSelectList({ data: ingredients, error: null }) as never
        }
        return makeWriteChain(ingredientInsertError ? { error: ingredientInsertError } : { error: null }) as never
      }
      if (table === 'steps') {
        if (mockFrom.mock.calls.filter((c) => c[0] === 'steps').length === 1) {
          return makeSelectList({ data: steps, error: null }) as never
        }
        return makeWriteChain(stepInsertError ? { error: stepInsertError } : { error: null }) as never
      }
      return makeWriteChain() as never
    })

    return { counts, rollback }
  }

  function makeRequest(body: object) {
    return new NextRequest('http://localhost/api/discover/add', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    })
  }

  it('returns 401 when not authenticated', async () => {
    mockServerClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    } as never)
    const res = await addRecipe(makeRequest({ recipe_id: 'pool-1' }))
    expect(res.status).toBe(401)
  })

  it('returns 403 when user has no household', async () => {
    setupAdd({ membership: null })
    const res = await addRecipe(makeRequest({ recipe_id: 'pool-1' }))
    expect(res.status).toBe(403)
  })

  it('returns 400 when recipe_id is missing', async () => {
    setupAdd()
    const res = await addRecipe(makeRequest({}))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'recipe_id is required' })
  })

  it('returns 404 when recipe is not in pool', async () => {
    setupAdd({ source: null })
    const res = await addRecipe(makeRequest({ recipe_id: 'pool-1' }))
    expect(res.status).toBe(404)
  })

  it('returns 404 when recipe has no source_url', async () => {
    setupAdd({
      source: {
        id: 'pool-1', title: 'No Source', cuisine_id: 'american',
        meal_type_id: 'entree', servings: 2, source_url: null, notes: null,
      },
    })
    const res = await addRecipe(makeRequest({ recipe_id: 'pool-1' }))
    expect(res.status).toBe(404)
  })

  it('clones the recipe and returns 201 with recipe_id', async () => {
    setupAdd()
    const res = await addRecipe(makeRequest({ recipe_id: 'pool-1' }))
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ recipe_id: 'clone-1' })
  })

  it('carries source_url onto the clone and sets is_discoverable to false so it does not re-enter the pool', async () => {
    const cloneChain = makeInsertSingle({ data: { id: 'clone-1' }, error: null })
    setupAdd({ cloneInsertChain: cloneChain })
    await addRecipe(makeRequest({ recipe_id: 'pool-1' }))
    const insertArg = (cloneChain.insert as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(insertArg.source_url).toBe('https://seriouseats.com/lemon-pasta')
    expect(insertArg.is_discoverable).toBe(false)
    expect(insertArg.capture_method).toBe('discover')
  })

  it('returns 429 when the household has hit the hourly rate limit', async () => {
    setupAdd({ recentAddCount: 20 })
    const res = await addRecipe(makeRequest({ recipe_id: 'pool-1' }))
    expect(res.status).toBe(429)
  })

  it('returns 500 when clone insert fails', async () => {
    setupAdd({ cloneResult: { data: null, error: { message: 'DB error' } } })
    const res = await addRecipe(makeRequest({ recipe_id: 'pool-1' }))
    expect(res.status).toBe(500)
  })

  it('rolls back orphaned recipe when ingredient insert fails', async () => {
    const { counts, rollback } = setupAdd({ ingredientInsertError: { message: 'DB error' } })
    const res = await addRecipe(makeRequest({ recipe_id: 'pool-1' }))
    expect(res.status).toBe(500)
    expect(counts.recipes).toBe(4)  // count + source + clone + rollback
    expect(rollback.chain?.delete).toHaveBeenCalled()
  })
})

// ── POST /api/discover/dismiss ────────────────────────────────────────────────

describe('POST /api/discover/dismiss', () => {
  function setupDismiss({
    membership = MEMBERSHIP as object | null,
    insertError = null as { code?: string; message?: string } | null,
  } = {}) {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'household_members') {
        return makeSelectSingle({ data: membership, error: null }) as never
      }
      if (table === 'discover_dismissals') {
        return makeWriteChain(insertError ? { error: insertError } : { error: null }) as never
      }
      return makeWriteChain() as never
    })
  }

  function makeRequest(body: object) {
    return new NextRequest('http://localhost/api/discover/dismiss', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    })
  }

  it('returns 401 when not authenticated', async () => {
    mockServerClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    } as never)
    const res = await dismiss(makeRequest({ recipe_id: 'pool-1' }))
    expect(res.status).toBe(401)
  })

  it('returns 403 when user has no household', async () => {
    setupDismiss({ membership: null })
    const res = await dismiss(makeRequest({ recipe_id: 'pool-1' }))
    expect(res.status).toBe(403)
  })

  it('returns 400 when recipe_id is missing', async () => {
    setupDismiss()
    const res = await dismiss(makeRequest({}))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'recipe_id is required' })
  })

  it('returns 201 on successful dismissal', async () => {
    setupDismiss()
    const res = await dismiss(makeRequest({ recipe_id: 'pool-1' }))
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ ok: true })
  })

  it('returns 200 when recipe was already dismissed (idempotent)', async () => {
    setupDismiss({ insertError: { code: '23505', message: 'duplicate key' } })
    const res = await dismiss(makeRequest({ recipe_id: 'pool-1' }))
    expect(res.status).toBe(200)
  })

  it('returns 500 on unexpected DB error', async () => {
    setupDismiss({ insertError: { code: '42P01', message: 'relation not found' } })
    const res = await dismiss(makeRequest({ recipe_id: 'pool-1' }))
    expect(res.status).toBe(500)
  })
})
