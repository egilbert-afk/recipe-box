import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { trackEvent } from '@/lib/events'
import { sanitizeInviteCode, sanitizeShareToken } from '@/lib/utils'

// Handles Supabase auth redirects (e.g. email confirmation links).
// The response object must be created first so the Supabase client can
// write session cookies directly onto it — cookies() from next/headers
// does not attach to a separately-created NextResponse.redirect().
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const type = searchParams.get('type')
  const inviteCode = sanitizeInviteCode(searchParams.get('invite_code'))
  const saveToken = sanitizeShareToken(searchParams.get('save_token'))

  if (code) {
    const destination = type === 'recovery'
      ? `${origin}/reset-password`
      : inviteCode
        ? `${origin}/onboarding?code=${inviteCode}`
        : saveToken
          ? `${origin}/onboarding?save=${saveToken}`
          : `${origin}/recipes`
    const response = NextResponse.redirect(destination)

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
      // Google (and any future OAuth provider) never hits our signUp() action, so there's
      // no separate signup step to fire this from — created_at === last_sign_in_at only on
      // the very first sign-in, which is how we tell a new OAuth account from a returning one.
      const isNewOAuthUser = type === 'oauth' && sessionData.user?.created_at === sessionData.user?.last_sign_in_at
      if ((type === 'signup' || isNewOAuthUser) && sessionData.user) {
        try {
          await trackEvent(sessionData.user.id, null, 'account_created')
          if (saveToken) await trackEvent(sessionData.user.id, null, 'signup_from_share')
        } catch (err) {
          console.error('trackEvent failed after signup confirmation:', err)
        }
      }
      return response
    }
  }

  return NextResponse.redirect(`${origin}/login?error=That+sign-in+link+has+expired.+Try+signing+in+again.`)
}
