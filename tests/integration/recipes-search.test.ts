import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}))

import { GET } from '@/app/api/recipes/search/route'
import { supabase } from '@/lib/supabase'

const mockRpc = vi.mocked(supabase.rpc)

const mockResults = [
  { id: '1', title: 'Roast Chicken', cuisine_id: 'american', meal_type_id: 'entree', servings: 4, match_count: 2 },
  { id: '2', title: 'Lemon Pasta', cuisine_id: 'italian', meal_type_id: 'entree', servings: 2, match_count: 1 },
]

function makeRequest(q?: string) {
  const url = q
    ? `http://localhost/api/recipes/search?q=${encodeURIComponent(q)}`
    : 'http://localhost/api/recipes/search'
  return new NextRequest(url)
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('GET /api/recipes/search', () => {
  it('returns 400 when no query is provided', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Search query is required' })
  })

  it('returns 400 when query exceeds 200 characters', async () => {
    const res = await GET(makeRequest('a'.repeat(201)))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Search query must be 200 characters or fewer' })
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('returns empty array when query contains only stopwords', async () => {
    const res = await GET(makeRequest('and the or'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('returns 400 for whitespace-only query', async () => {
    const res = await GET(makeRequest('   '))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Search query is required' })
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('calls rpc with OR-joined tsquery and returns results', async () => {
    mockRpc.mockResolvedValueOnce({ data: mockResults, error: null } as any)

    const res = await GET(makeRequest('chicken lemon'))

    expect(res.status).toBe(200)
    expect(mockRpc).toHaveBeenCalledWith('search_recipes_by_ingredient', { query: 'chicken | lemon' })
    expect(await res.json()).toEqual(mockResults)
  })

  it('strips stopwords from the query before calling rpc', async () => {
    mockRpc.mockResolvedValueOnce({ data: mockResults, error: null } as any)

    await GET(makeRequest('chicken and lemon'))

    expect(mockRpc).toHaveBeenCalledWith('search_recipes_by_ingredient', { query: 'chicken | lemon' })
  })

  it('returns 500 when supabase rpc returns an error', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'DB error', details: '', hint: '', code: '500', toJSON: () => ({}), name: 'PostgrestError' } } as any)

    const res = await GET(makeRequest('chicken'))

    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({ error: 'DB error' })
  })

  it('returns empty array when rpc returns null data', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null } as any)

    const res = await GET(makeRequest('chicken'))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })
})
