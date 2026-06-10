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

function makeChain(singleResult?: object) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'insert', 'delete', 'update', 'eq', 'single', 'maybeSingle']
  for (const m of methods) chain[m] = vi.fn().mockReturnValue(chain)
  if (singleResult !== undefined) {
    ;(chain.single as ReturnType<typeof vi.fn>).mockResolvedValue(singleResult)
  }
  return chain
}

// The edit path hits four tables: household_members, recipes, ingredients, steps.
// Returns each chain so tests can assert on them.
function setupFrom(membershipData: object | null, recipeSingleResult?: object) {
  const recipesChain = makeChain(recipeSingleResult ?? { data: { id: 'abc-123' }, error: null })
  const ingredientsChain = makeChain()
  const stepsChain = makeChain()

  mockFrom.mockImplementation((table: string) => {
    if (table === 'household_members') {
      const m = makeChain()
      ;(m.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: membershipData, error: null,
      })
      return m as never
    }
    if (table === 'recipes') return recipesChain as never
    if (table === 'ingredients') return ingredientsChain as never
    if (table === 'steps') return stepsChain as never
    return makeChain() as never
  })

  return { recipesChain, ingredientsChain, stepsChain }
}

function makeRequest(id: string, body: object) {
  return new NextRequest(`http://localhost/api/recipes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

const validEditBody = {
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

// ── PATCH /api/recipes/[id] — edit — validation ───────────────────────────────

describe('PATCH /api/recipes/[id] — edit — validation', () => {
  it('returns 400 when title is empty', async () => {
    const req = makeRequest('abc-123', { ...validEditBody, title: '' })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'abc-123' }) })
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Title is required' })
  })

  it('returns 400 when title is whitespace only', async () => {
    const req = makeRequest('abc-123', { ...validEditBody, title: '   ' })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'abc-123' }) })
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Title is required' })
  })

  it('returns 400 when title exceeds 200 characters', async () => {
    const req = makeRequest('abc-123', { ...validEditBody, title: 'x'.repeat(201) })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'abc-123' }) })
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Title must be 200 characters or fewer' })
  })

  it('returns 400 when cuisine_id is missing', async () => {
    const { cuisine_id: _, ...body } = validEditBody
    const req = makeRequest('abc-123', body)
    const res = await PATCH(req, { params: Promise.resolve({ id: 'abc-123' }) })
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Cuisine is required' })
  })

  it('returns 400 when meal_type_id is missing', async () => {
    const { meal_type_id: _, ...body } = validEditBody
    const req = makeRequest('abc-123', body)
    const res = await PATCH(req, { params: Promise.resolve({ id: 'abc-123' }) })
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Meal type is required' })
  })

  it('returns 400 when servings is 0', async () => {
    const req = makeRequest('abc-123', { ...validEditBody, servings: 0 })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'abc-123' }) })
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Servings must be at least 1' })
  })

  it('returns 400 when notes exceed 1000 characters', async () => {
    const req = makeRequest('abc-123', { ...validEditBody, notes: 'n'.repeat(1001) })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'abc-123' }) })
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Notes must be 1000 characters or fewer' })
  })

  it('returns 400 when an ingredient name exceeds 200 characters', async () => {
    const req = makeRequest('abc-123', {
      ...validEditBody,
      ingredients: [{ name: 'x'.repeat(201), amount: null, unit: null, order_index: 0 }],
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'abc-123' }) })
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Ingredient names must be 200 characters or fewer' })
  })

  it('returns 400 when a step instruction exceeds 2000 characters', async () => {
    const req = makeRequest('abc-123', {
      ...validEditBody,
      steps: [{ instruction: 'x'.repeat(2001), order_index: 0 }],
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'abc-123' }) })
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Step instructions must be 2000 characters or fewer' })
  })
})

// ── PATCH /api/recipes/[id] — edit — auth & ownership ────────────────────────

describe('PATCH /api/recipes/[id] — edit — auth & ownership', () => {
  it('returns 401 when not authenticated', async () => {
    mockServerClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    } as never)
    const req = makeRequest('abc-123', validEditBody)
    const res = await PATCH(req, { params: Promise.resolve({ id: 'abc-123' }) })
    expect(res.status).toBe(401)
  })

  it('returns 404 when recipe does not belong to the household', async () => {
    setupFrom(
      { household_id: 'hh-1' },
      { data: null, error: { code: 'PGRST116', message: 'Not found' } }
    )
    const req = makeRequest('other-recipe', validEditBody)
    const res = await PATCH(req, { params: Promise.resolve({ id: 'other-recipe' }) })
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ error: 'Recipe not found' })
  })
})

// ── PATCH /api/recipes/[id] — edit — success ─────────────────────────────────

describe('PATCH /api/recipes/[id] — edit — success', () => {
  it('returns 200 with the recipe id', async () => {
    const req = makeRequest('abc-123', validEditBody)
    const res = await PATCH(req, { params: Promise.resolve({ id: 'abc-123' }) })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ id: 'abc-123' })
  })

  it('trims title and notes before writing to the database', async () => {
    const { recipesChain } = setupFrom({ household_id: 'hh-1' })
    const req = makeRequest('abc-123', { ...validEditBody, title: '  Pasta  ', notes: '  good  ' })
    await PATCH(req, { params: Promise.resolve({ id: 'abc-123' }) })
    expect(recipesChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Pasta', notes: 'good' })
    )
  })

  it('saves notes as null when an empty string is sent', async () => {
    const { recipesChain } = setupFrom({ household_id: 'hh-1' })
    const req = makeRequest('abc-123', { ...validEditBody, notes: '' })
    await PATCH(req, { params: Promise.resolve({ id: 'abc-123' }) })
    expect(recipesChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ notes: null })
    )
  })
})
