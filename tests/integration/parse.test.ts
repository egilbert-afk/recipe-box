import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/claude', () => ({
  parseRecipeFromUrl: vi.fn(),
}))

import { POST } from '@/app/api/parse/route'
import { parseRecipeFromUrl } from '@/lib/claude'

const mockParseRecipeFromUrl = vi.mocked(parseRecipeFromUrl)

const mockRecipe = {
  title: 'Pasta Carbonara',
  cuisine_id: 'italian' as const,
  meal_type_id: 'entree' as const,
  servings: 4,
  source_url: 'https://example.com/carbonara',
  ingredients: [{ name: 'pasta', amount: 200, unit: 'g', order_index: 0 }],
  steps: [{ instruction: 'Boil pasta', order_index: 0 }],
}

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('POST /api/parse — validation', () => {
  it('returns 400 when URL is missing', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'URL is required' })
  })

  it('returns 400 when URL is an empty string', async () => {
    const res = await POST(makeRequest({ url: '   ' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'URL is required' })
  })

  it('returns 400 when URL is not a valid URL', async () => {
    const res = await POST(makeRequest({ url: 'not-a-url' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Invalid URL' })
  })

  it('returns 400 for an unparseable JSON body', async () => {
    const req = new NextRequest('http://localhost/api/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Invalid JSON' })
  })
})

describe('POST /api/parse — success', () => {
  it('returns 200 with the parsed recipe', async () => {
    mockParseRecipeFromUrl.mockResolvedValueOnce(mockRecipe)

    const res = await POST(makeRequest({ url: 'https://example.com/carbonara' }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.title).toBe('Pasta Carbonara')
    expect(mockParseRecipeFromUrl).toHaveBeenCalledWith('https://example.com/carbonara')
  })
})

describe('POST /api/parse — parse failure', () => {
  it('returns 422 when parseRecipeFromUrl throws', async () => {
    mockParseRecipeFromUrl.mockRejectedValueOnce(new Error('Could not parse recipe'))

    const res = await POST(makeRequest({ url: 'https://example.com/bad' }))

    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({ error: 'Could not parse recipe' })
  })

  it('returns a generic 422 message when error is not an Error instance', async () => {
    mockParseRecipeFromUrl.mockRejectedValueOnce('unexpected string error')

    const res = await POST(makeRequest({ url: 'https://example.com/bad' }))

    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({ error: 'Failed to parse recipe' })
  })
})
