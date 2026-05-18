import { NextRequest, NextResponse } from 'next/server'
import { parseRecipeFromText, parseRecipeFromImage } from '@/lib/claude'
import type { SupportedImageMimeType } from '@/lib/claude'

const SUPPORTED_IMAGE_TYPES: SupportedImageMimeType[] = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]

export async function POST(request: NextRequest) {
  let body: { text?: string; image?: string; mimeType?: string }

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
    try {
      const recipe = await parseRecipeFromText(body.text)
      return NextResponse.json(recipe)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to parse recipe'
      return NextResponse.json({ error: message }, { status: 422 })
    }
  }

  // Image path
  if (body.image !== undefined) {
    if (!body.image) {
      return NextResponse.json({ error: 'Image data is required' }, { status: 400 })
    }
    if (!SUPPORTED_IMAGE_TYPES.includes(body.mimeType as SupportedImageMimeType)) {
      return NextResponse.json(
        { error: 'Unsupported image type. Use JPEG, PNG, GIF, or WebP.' },
        { status: 400 }
      )
    }
    try {
      const recipe = await parseRecipeFromImage(body.image, body.mimeType as SupportedImageMimeType)
      return NextResponse.json(recipe)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to parse recipe'
      return NextResponse.json({ error: message }, { status: 422 })
    }
  }

  return NextResponse.json({ error: 'Provide either text or image data' }, { status: 400 })
}
