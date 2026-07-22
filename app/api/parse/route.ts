import { NextRequest, NextResponse } from 'next/server'
import { parseRecipeFromUrl, friendlyClaudeError } from '@/lib/claude'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  const serverClient = await createSupabaseServerClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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

  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
    return NextResponse.json({ error: 'URL must use http or https' }, { status: 400 })
  }

  try {
    const recipe = await parseRecipeFromUrl(url)
    return NextResponse.json(recipe)
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    const autoSwitch = msg.includes('blocked') || msg.includes('subscription')
    return NextResponse.json({ error: friendlyClaudeError(err), autoSwitch }, { status: 422 })
  }
}
