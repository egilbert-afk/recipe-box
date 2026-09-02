import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { trackEvent } from '@/lib/events'
import { sanitizeInviteCode, sanitizeShareToken } from '@/lib/utils'
import type { AuthCallbackType } from '@/lib/auth-callback'
import type { User } from '@supabase/supabase-js'

// A brand-new OAuth account's created_at and last_sign_in_at are written moments apart, not
// atomically — comparing for exact equality is fragile, so treat anything within a few seconds
// as "this is the user's first sign-in" (a returning user's last_sign_in_at will be much newer).
function isFirstSignIn(user: User): boolean {
  const created = new Date(user.created_at).getTime()
  const lastSignIn = new Date(user.last_sign_in_at ?? 0).getTime()
  return Math.abs(lastSignIn - created) < 5000
}

// Handles Supabase auth redirects (e.g. email confirmation links, OAuth callbacks).
// The response object must be created first so the Supabase client can
// write session cookies directly onto it — cookies() from next/headers
// does not attach to a separately-created NextResponse.redirect().
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const type = searchParams.get('type') as AuthCallbackType | null
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
      // no separate signup step to fire this from — isFirstSignIn() is how we tell a new
      // OAuth account from a returning one.
      const isNewOAuthUser = type === 'oauth' && sessionData.user && isFirstSignIn(sessionData.user)
      if ((type === 'signup' || isNewOAuthUser) && sessionData.user) {
        const userId = sessionData.user.id
        trackEvent(userId, null, 'account_created').catch((err) =>
          console.error('trackEvent failed after signup confirmation:', err)
        )
        if (saveToken) {
          trackEvent(userId, null, 'signup_from_share').catch((err) =>
            console.error('trackEvent failed after signup confirmation:', err)
          )
        }
      }
      return response
    }
  }

  // Google redirects back with `error`/`error_description` (no `code`) when the user cancels
  // or denies consent — that's not the same situation as a genuinely expired link, so it gets
  // its own honest message instead of the generic one.
  const oauthError = searchParams.get('error')
  if (oauthError) {
    const message = oauthError === 'access_denied'
      ? 'Google+sign-in+was+cancelled.'
      : 'Google+sign-in+failed.+Please+try+again.'
    return NextResponse.redirect(`${origin}/login?error=${message}`)
  }

  return NextResponse.redirect(`${origin}/login?error=That+sign-in+link+has+expired.+Try+signing+in+again.`)
}
