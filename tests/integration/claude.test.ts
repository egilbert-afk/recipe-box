import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.hoisted ensures mockCreate is defined before vi.mock hoists the factory to the top of the file
const mockCreate = vi.hoisted(() => vi.fn())

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: mockCreate }
  },
}))

import { parseRecipeFromUrl } from '@/lib/claude'

const validClaudeResponse = {
  title: 'Test Pasta',
  cuisine_id: 'italian',
  meal_type_id: 'entree',
  servings: 4,
  ingredients: [{ name: 'pasta', amount: 200, unit: 'g', order_index: 0 }],
  steps: [{ instruction: 'Boil pasta until al dente', order_index: 0 }],
}

function mockFetchOk(html = '<html><p>Recipe content</p></html>') {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    text: () => Promise.resolve(html),
  }))
}

beforeEach(() => {
  vi.resetAllMocks()
  mockFetchOk()
})

describe('parseRecipeFromUrl', () => {
  it('returns a valid CreateRecipeInput on success', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(validClaudeResponse) }],
    })

    const result = await parseRecipeFromUrl('https://example.com/recipe')

    expect(result.title).toBe('Test Pasta')
    expect(result.cuisine_id).toBe('italian')
    expect(result.source_url).toBe('https://example.com/recipe')
    expect(result.ingredients).toHaveLength(1)
    expect(result.steps).toHaveLength(1)
  })

  it('strips markdown fences if Claude includes them despite instructions', async () => {
    const withFences = '```json\n' + JSON.stringify(validClaudeResponse) + '\n```'
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: withFences }],
    })

    const result = await parseRecipeFromUrl('https://example.com/recipe')
    expect(result.title).toBe('Test Pasta')
  })

  it('throws when fetch returns a non-OK status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    }))

    await expect(parseRecipeFromUrl('https://example.com')).rejects.toThrow('Failed to fetch URL: 403')
  })

  it('throws when Claude returns malformed JSON', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'not json at all' }],
    })

    await expect(parseRecipeFromUrl('https://example.com')).rejects.toThrow('malformed JSON')
  })

  it('throws when Claude response is missing required fields', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify({ title: 'Incomplete' }) }],
    })

    await expect(parseRecipeFromUrl('https://example.com')).rejects.toThrow('incomplete recipe data')
  })

  it('throws when Claude returns an empty ingredients array', async () => {
    const noIngredients = { ...validClaudeResponse, ingredients: [] }
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(noIngredients) }],
    })

    await expect(parseRecipeFromUrl('https://example.com')).rejects.toThrow('incomplete recipe data')
  })

  it('throws when Claude returns an empty steps array', async () => {
    const noSteps = { ...validClaudeResponse, steps: [] }
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(noSteps) }],
    })

    await expect(parseRecipeFromUrl('https://example.com')).rejects.toThrow('incomplete recipe data')
  })
})
