import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { trackEvent } from '@/lib/events'

// Handles Supabase auth redirects (e.g. email confirmation links).
// The response object must be created first so the Supabase client can
// write session cookies directly onto it — cookies() from next/headers
// does not attach to a separately-created NextResponse.redirect().
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const type = searchParams.get('type')

  if (code) {
    const response = NextResponse.redirect(`${origin}/recipes`)

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      if (type === 'signup' && sessionData.user) {
        try {
          await trackEvent(sessionData.user.id, null, 'account_created')
        } catch (err) {
          console.error('trackEvent failed after signup confirmation:', err)
        }
      }
      return response
    }
  }

  return NextResponse.redirect(`${origin}/login?error=That+sign-in+link+has+expired.+Try+signing+in+again.`)
}
