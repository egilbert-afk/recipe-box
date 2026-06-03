import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/recipes/route'
import { GET as getById } from '@/app/api/recipes/[id]/route'

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

// Builds a fresh chainable mock. Resolves single() and order() with the result.
function makeChain(result?: object) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'insert', 'delete', 'update', 'eq', 'order', 'single', 'maybeSingle']
  for (const m of methods) chain[m] = vi.fn().mockReturnValue(chain)
  if (result !== undefined) {
    ;(chain.single as ReturnType<typeof vi.fn>).mockResolvedValue(result)
    ;(chain.order as ReturnType<typeof vi.fn>).mockResolvedValue(result)
  }
  return chain
}

// Configures supabase.from() to return membership data for household_members
// and a shared chain (optionally pre-configured) for all other tables.
function setupFrom(
  membershipData: object | null,
  otherChain?: Record<string, unknown>
) {
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

function makeRequest(body: object) {
  return new NextRequest('http://localhost/api/recipes', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

const validRecipeBody = {
  title: 'Spaghetti Bolognese',
  cuisine_id: 'italian',
  meal_type_id: 'entree',
  servings: 4,
  ingredients: [{ name: 'pasta', amount: 400, unit: 'g', order_index: 0 }],
  steps: [{ instruction: 'Boil pasta', order_index: 0 }],
}

beforeEach(() => {
  vi.clearAllMocks()
  authAs('user-1')
  setupFrom({ household_id: 'hh-1' })
})

// ── POST /api/recipes — validation ────────────────────────────────────────────

describe('POST /api/recipes — validation', () => {
  it('returns 400 when title is missing', async () => {
    const res = await POST(makeRequest({ ...validRecipeBody, title: '' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Title is required' })
  })

  it('returns 400 when cuisine_id is missing', async () => {
    const res = await POST(makeRequest({ ...validRecipeBody, cuisine_id: '' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Cuisine is required' })
  })

  it('returns 400 when meal_type_id is missing', async () => {
    const res = await POST(makeRequest({ ...validRecipeBody, meal_type_id: '' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Meal type is required' })
  })

  it('returns 400 when servings is less than 1', async () => {
    const res = await POST(makeRequest({ ...validRecipeBody, servings: 0 }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Servings must be at least 1' })
  })

  it('returns 400 when ingredients are empty', async () => {
    const res = await POST(makeRequest({ ...validRecipeBody, ingredients: [] }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'At least one ingredient is required' })
  })

  it('returns 400 when steps are empty', async () => {
    const res = await POST(makeRequest({ ...validRecipeBody, steps: [] }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'At least one step is required' })
  })

  it('returns 400 when title exceeds 200 characters', async () => {
    const res = await POST(makeRequest({ ...validRecipeBody, title: 'A'.repeat(201) }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Title must be 200 characters or fewer' })
  })

  it('returns 400 when source_url is not a valid URL', async () => {
    const res = await POST(makeRequest({ ...validRecipeBody, source_url: 'not-a-url' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'source_url must be a valid URL' })
  })

  it('returns 400 when source_url uses a non-http scheme', async () => {
    const res = await POST(makeRequest({ ...validRecipeBody, source_url: 'file:///etc/passwd' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'source_url must use http or https' })
  })

  it('returns 400 when an ingredient name exceeds 200 characters', async () => {
    const res = await POST(makeRequest({
      ...validRecipeBody,
      ingredients: [{ name: 'A'.repeat(201), amount: 1, unit: 'cup', order_index: 0 }],
    }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Ingredient names must be 200 characters or fewer' })
  })

  it('returns 400 when a step instruction exceeds 2000 characters', async () => {
    const res = await POST(makeRequest({
      ...validRecipeBody,
      steps: [{ instruction: 'A'.repeat(2001), order_index: 0 }],
    }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Step instructions must be 2000 characters or fewer' })
  })
})

// ── POST /api/recipes — success ────────────────────────────────────────────────

describe('POST /api/recipes — success', () => {
  it('returns 201 with the created recipe', async () => {
    const fakeRecipe = { id: 'abc-123', title: 'Spaghetti Bolognese' }
    setupFrom({ household_id: 'hh-1' }, makeChain({ data: fakeRecipe, error: null }))

    const res = await POST(makeRequest(validRecipeBody))
    expect(res.status).toBe(201)
  })

  it('uses capture_method from the request body when valid', async () => {
    const chain = setupFrom({ household_id: 'hh-1' }, makeChain({ data: { id: 'abc-123', title: 'Test' }, error: null }))

    await POST(makeRequest({ ...validRecipeBody, capture_method: 'email' }))

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ capture_method: 'email' })
    )
  })

  it('defaults capture_method to manual when an unrecognised value is provided', async () => {
    const chain = setupFrom({ household_id: 'hh-1' }, makeChain({ data: { id: 'abc-123', title: 'Test' }, error: null }))

    await POST(makeRequest({ ...validRecipeBody, capture_method: 'hacked' }))

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ capture_method: 'manual' })
    )
  })

  it('includes household_id and created_by in the recipe insert', async () => {
    const chain = setupFrom({ household_id: 'hh-1' }, makeChain({ data: { id: 'abc-123', title: 'Test' }, error: null }))

    await POST(makeRequest(validRecipeBody))

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ household_id: 'hh-1', created_by: 'user-1' })
    )
  })
})

// ── GET /api/recipes ──────────────────────────────────────────────────────────

describe('GET /api/recipes', () => {
  it('returns 200 with a list of recipes', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
  })
})

// ── GET /api/recipes/[id] ─────────────────────────────────────────────────────

describe('GET /api/recipes/[id]', () => {
  it('returns 404 when recipe is not found', async () => {
    const chain = makeChain()
    ;(chain.single as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: null, error: { code: 'PGRST116', message: 'Not found' },
    })
    setupFrom({ household_id: 'hh-1' }, chain)

    const req = new NextRequest('http://localhost/api/recipes/nonexistent')
    const res = await getById(req, { params: Promise.resolve({ id: 'nonexistent' }) })
    expect(res.status).toBe(404)
  })

  it('returns 200 with recipe, ingredients, and steps', async () => {
    const fakeRecipe = { id: 'abc-123', title: 'Spaghetti Bolognese' }
    const chain = makeChain()
    ;(chain.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: fakeRecipe, error: null })
    ;(chain.order as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [], error: null })
    setupFrom({ household_id: 'hh-1' }, chain)

    const req = new NextRequest('http://localhost/api/recipes/abc-123')
    const res = await getById(req, { params: Promise.resolve({ id: 'abc-123' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ ...fakeRecipe, ingredients: [], steps: [] })
  })
})
