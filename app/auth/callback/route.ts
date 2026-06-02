import { createSupabaseServerClient } from '@/lib/supabase-server'
import { NextResponse, type NextRequest } from 'next/server'

// Handles Supabase auth redirects (e.g. email confirmation links).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}/recipes`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=Authentication+failed`)
}
