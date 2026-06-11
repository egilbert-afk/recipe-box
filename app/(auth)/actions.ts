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
    redirect(`/login?error=Invalid+email+or+password${codeParam}`)
  }

  if (code) redirect(`/onboarding?code=${code}`)
  if (save) redirect(`/r/${save}?autosave=1`)
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
    redirect(`/signup?error=${encodeURIComponent(error.message)}${extraParam}`)
  }

  // When Supabase requires email confirmation, session is null — prompt the user.
  if (!data.session) {
    redirect('/signup?message=Check+your+email+to+confirm+your+account')
  }

  await trackEvent(data.session.user.id, null, 'account_created')
  if (save) await trackEvent(data.session.user.id, null, 'signup_from_share')

  if (code) redirect(`/onboarding?code=${code}`)
  if (save) redirect(`/onboarding?save=${save}`)
  redirect('/onboarding')
}

export async function signOut() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect('/login')
}
