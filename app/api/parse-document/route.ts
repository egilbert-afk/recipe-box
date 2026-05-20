import { NextRequest, NextResponse } from 'next/server'
import { parseRecipeFromText, parseRecipeFromImage } from '@/lib/claude'
import type { SupportedImageMimeType } from '@/lib/claude'

const SUPPORTED_IMAGE_TYPES: SupportedImageMimeType[] = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]

type ImageInput = { data: string; mimeType: string }

export async function POST(request: NextRequest) {
  let body: { text?: string; images?: unknown }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Text path
  if (body.text !== undefined) {
    if (!body.text.trim()) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }
    if (body.text.length > 50000) {
      return NextResponse.json({ error: 'Text must be 50,000 characters or fewer' }, { status: 400 })
    }
    try {
      const recipe = await parseRecipeFromText(body.text)
      return NextResponse.json(recipe)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to parse recipe'
      return NextResponse.json({ error: message }, { status: 422 })
    }
  }

  // Image path
  if (body.images !== undefined) {
    if (!Array.isArray(body.images) || body.images.length === 0) {
      return NextResponse.json({ error: 'At least one image is required' }, { status: 400 })
    }
    if (body.images.length > 10) {
      return NextResponse.json({ error: 'Too many images — maximum 10 per request' }, { status: 400 })
    }

    for (const img of body.images) {
      if (typeof img !== 'object' || img === null) {
        return NextResponse.json({ error: 'Each image must be an object with data and mimeType' }, { status: 400 })
      }
      const { data, mimeType } = img as ImageInput
      if (!data) {
        return NextResponse.json({ error: 'Image data is required' }, { status: 400 })
      }
      if (!SUPPORTED_IMAGE_TYPES.includes(mimeType as SupportedImageMimeType)) {
        return NextResponse.json(
          { error: 'Unsupported image type. Use JPEG, PNG, GIF, or WebP.' },
          { status: 400 }
        )
      }
    }

    try {
      const recipe = await parseRecipeFromImage(
        (body.images as ImageInput[]).map((img) => ({
          data: img.data,
          mimeType: img.mimeType as SupportedImageMimeType,
        }))
      )
      return NextResponse.json(recipe)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to parse recipe'
      return NextResponse.json({ error: message }, { status: 422 })
    }
  }

  return NextResponse.json({ error: 'Provide either text or image data' }, { status: 400 })
}
