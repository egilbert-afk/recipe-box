import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/claude', () => ({
  parseRecipeFromText: vi.fn(),
  parseRecipeFromImage: vi.fn(),
}))

import { POST } from '@/app/api/parse-document/route'
import { parseRecipeFromText, parseRecipeFromImage } from '@/lib/claude'

const mockParseText = vi.mocked(parseRecipeFromText)
const mockParseImage = vi.mocked(parseRecipeFromImage)

const mockRecipe = {
  title: 'Pasta Carbonara',
  cuisine_id: 'italian' as const,
  meal_type_id: 'entree' as const,
  servings: 4,
  ingredients: [{ name: 'pasta', amount: 200, unit: 'g', order_index: 0 }],
  steps: [{ instruction: 'Boil pasta', order_index: 0 }],
}

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/parse-document', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('POST /api/parse-document — no input', () => {
  it('returns 400 when neither text nor image is provided', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Provide either text or image data' })
  })

  it('returns 400 for an unparseable JSON body', async () => {
    const req = new NextRequest('http://localhost/api/parse-document', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Invalid JSON' })
  })
})

describe('POST /api/parse-document — text', () => {
  it('returns 400 when text is empty', async () => {
    const res = await POST(makeRequest({ text: '   ' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Text is required' })
  })

  it('returns 200 with the parsed recipe', async () => {
    mockParseText.mockResolvedValueOnce(mockRecipe)

    const res = await POST(makeRequest({ text: 'Pasta carbonara recipe...' }))

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ title: 'Pasta Carbonara' })
    expect(mockParseText).toHaveBeenCalledWith('Pasta carbonara recipe...')
  })

  it('returns 422 when parsing fails', async () => {
    mockParseText.mockRejectedValueOnce(new Error('Could not parse recipe'))

    const res = await POST(makeRequest({ text: 'some text' }))

    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({ error: 'Could not parse recipe' })
  })
})

describe('POST /api/parse-document — image', () => {
  it('returns 400 when image data is empty', async () => {
    const res = await POST(makeRequest({ image: '', mimeType: 'image/jpeg' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Image data is required' })
  })

  it('returns 400 for an unsupported MIME type', async () => {
    const res = await POST(makeRequest({ image: 'base64data==', mimeType: 'image/bmp' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Unsupported image type. Use JPEG, PNG, GIF, or WebP.' })
  })

  it('returns 400 when mimeType is missing', async () => {
    const res = await POST(makeRequest({ image: 'base64data==' }))
    expect(res.status).toBe(400)
  })

  it('returns 200 with the parsed recipe', async () => {
    mockParseImage.mockResolvedValueOnce(mockRecipe)

    const res = await POST(makeRequest({ image: 'base64data==', mimeType: 'image/jpeg' }))

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ title: 'Pasta Carbonara' })
    expect(mockParseImage).toHaveBeenCalledWith('base64data==', 'image/jpeg')
  })

  it('returns 422 when parsing fails', async () => {
    mockParseImage.mockRejectedValueOnce(new Error('Could not read image'))

    const res = await POST(makeRequest({ image: 'base64data==', mimeType: 'image/png' }))

    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({ error: 'Could not read image' })
  })
})
