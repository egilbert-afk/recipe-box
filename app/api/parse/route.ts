import { NextRequest, NextResponse } from 'next/server'
import { parseRecipeFromUrl } from '@/lib/claude'

export async function POST(request: NextRequest) {
  let body: { url?: string }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const url = body.url?.trim()

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 })
  }

  try {
    new URL(url)
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  try {
    const recipe = await parseRecipeFromUrl(url)
    return NextResponse.json(recipe)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to parse recipe'
    return NextResponse.json({ error: message }, { status: 422 })
  }
}
