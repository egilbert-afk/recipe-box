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
  it('returns 400 when neither text nor images is provided', async () => {
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

describe('POST /api/parse-document — images', () => {
  it('returns 400 when images is an empty array', async () => {
    const res = await POST(makeRequest({ images: [] }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'At least one image is required' })
  })

  it('returns 400 when images exceeds the 10-image limit', async () => {
    const images = Array.from({ length: 11 }, (_, i) => ({ data: `page${i}==`, mimeType: 'image/jpeg' }))
    const res = await POST(makeRequest({ images }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Too many images — maximum 10 per request' })
  })

  it('returns 400 when an array element is not an object', async () => {
    const res = await POST(makeRequest({ images: ['not-an-object'] }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: expect.stringContaining('object') })
  })

  it('returns 400 when an image has no data', async () => {
    const res = await POST(makeRequest({ images: [{ data: '', mimeType: 'image/jpeg' }] }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Image data is required' })
  })

  it('returns 400 for an unsupported MIME type', async () => {
    const res = await POST(makeRequest({ images: [{ data: 'base64data==', mimeType: 'image/bmp' }] }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Unsupported image type. Use JPEG, PNG, GIF, or WebP.' })
  })

  it('returns 200 with a single image', async () => {
    mockParseImage.mockResolvedValueOnce(mockRecipe)

    const res = await POST(makeRequest({ images: [{ data: 'base64data==', mimeType: 'image/jpeg' }] }))

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ title: 'Pasta Carbonara' })
    expect(mockParseImage).toHaveBeenCalledWith([{ data: 'base64data==', mimeType: 'image/jpeg' }])
  })

  it('returns 200 with multiple images', async () => {
    mockParseImage.mockResolvedValueOnce(mockRecipe)

    const res = await POST(makeRequest({
      images: [
        { data: 'page1==', mimeType: 'image/jpeg' },
        { data: 'page2==', mimeType: 'image/png' },
      ],
    }))

    expect(res.status).toBe(200)
    expect(mockParseImage).toHaveBeenCalledWith([
      { data: 'page1==', mimeType: 'image/jpeg' },
      { data: 'page2==', mimeType: 'image/png' },
    ])
  })

  it('returns 422 when parsing fails', async () => {
    mockParseImage.mockRejectedValueOnce(new Error('Could not read image'))

    const res = await POST(makeRequest({ images: [{ data: 'base64data==', mimeType: 'image/png' }] }))

    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({ error: 'Could not read image' })
  })
})
