'use server'

import { createSupabaseServerClient } from '@/lib/supabase-server'
import { trackEvent } from '@/lib/events'
import { sanitizeInviteCode, sanitizeShareToken } from '@/lib/utils'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

export async function signIn(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const code = sanitizeInviteCode(formData.get('code') as string | null)
  const save = sanitizeShareToken(formData.get('save') as string | null)

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    const codeParam = code ? `&code=${code}` : save ? `&save=${save}` : ''
    redirect(`/login?error=Invalid+email+or+password.+Double-check+and+try+again.${codeParam}`)
  }

  if (code) redirect(`/onboarding?code=${code}`)
  if (save) redirect(`/r/${save}`)
  redirect('/recipes')
}

export async function signUp(formData: FormData) {
  const email = (formData.get('email') as string) ?? ''
  const password = (formData.get('password') as string) ?? ''
  const confirmPassword = (formData.get('confirm_password') as string) ?? ''
  const code = sanitizeInviteCode(formData.get('code') as string | null)
  const save = sanitizeShareToken(formData.get('save') as string | null)

  const extraParam = code ? `&code=${code}` : save ? `&save=${save}` : ''

  if (!email || !password) {
    redirect(`/signup?error=Email+and+password+are+required${extraParam}`)
  }

  if (password.length < 6) {
    redirect(`/signup?error=Password+must+be+at+least+6+characters${extraParam}`)
  }

  if (password !== confirmPassword) {
    redirect(`/signup?error=Passwords+do+not+match${extraParam}`)
  }

  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3000'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const callbackUrl = code
    ? `${protocol}://${host}/auth/callback?type=signup&invite_code=${code}`
    : save
      ? `${protocol}://${host}/auth/callback?type=signup&save_token=${save}`
      : `${protocol}://${host}/auth/callback?type=signup`

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: callbackUrl } })

  if (error) {
    const raw = error.message.toLowerCase()
    const friendlyMsg = raw.includes('user already registered') || raw.includes('already registered')
      ? 'An account with that email already exists. Try signing in instead.'
      : raw.includes('rate limit') || raw.includes('too many') || raw.includes('email sending')
        ? 'Too many attempts. Please wait a few minutes and try again.'
        : 'Something went wrong on our end. Tell us what happened using the Feedback button.'
    redirect(`/signup?error=${encodeURIComponent(friendlyMsg)}${extraParam}`)
  }

  // When Supabase requires email confirmation, session is null — prompt the user.
  if (!data.session) {
    redirect('/signup?message=Check+your+email+to+confirm+your+account')
  }

  try {
    await trackEvent(data.session.user.id, null, 'account_created')
    if (save) await trackEvent(data.session.user.id, null, 'signup_from_share')
  } catch (err) {
    console.error('trackEvent failed after signup:', err)
  }

  if (code) redirect(`/onboarding?code=${code}`)
  if (save) redirect(`/onboarding?save=${save}`)
  redirect('/onboarding')
}

export async function forgotPassword(formData: FormData) {
  const email = (formData.get('email') as string) ?? ''
  if (!email) {
    redirect('/forgot-password?error=Email+is+required')
  }

  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3000'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const redirectTo = `${protocol}://${host}/auth/callback?type=recovery`

  const supabase = await createSupabaseServerClient()
  await supabase.auth.resetPasswordForEmail(email, { redirectTo })

  // Always show the same message regardless of whether the email exists —
  // avoids leaking which emails are registered.
  redirect('/forgot-password?message=If+that+email+is+registered%2C+you%27ll+get+a+reset+link+shortly.+Check+your+inbox+and+spam+folder.')
}

export async function resetPassword(formData: FormData) {
  const password = (formData.get('password') as string) ?? ''
  const confirmPassword = (formData.get('confirm_password') as string) ?? ''

  if (password.length < 6) {
    redirect('/reset-password?error=Password+must+be+at+least+6+characters')
  }

  if (password !== confirmPassword) {
    redirect('/reset-password?error=Passwords+do+not+match')
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    const message = error.message.toLowerCase().includes('different')
      ? 'Your+new+password+must+be+different+from+your+current+one.'
      : 'Failed+to+update+password.+Your+reset+link+may+have+expired.+Request+a+new+one.'
    redirect(`/reset-password?error=${message}`)
  }

  redirect('/recipes')
}

export async function signOut() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect('/login')
}
