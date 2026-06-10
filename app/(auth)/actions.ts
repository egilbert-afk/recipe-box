'use server'

import { createSupabaseServerClient } from '@/lib/supabase-server'
import { trackEvent } from '@/lib/events'
import { sanitizeInviteCode } from '@/lib/utils'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

export async function signIn(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const code = sanitizeInviteCode(formData.get('code') as string | null)

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    const codeParam = code ? `&code=${code}` : ''
    redirect(`/login?error=Invalid+email+or+password${codeParam}`)
  }

  redirect(code ? `/onboarding?code=${code}` : '/recipes')
}

export async function signUp(formData: FormData) {
  const email = (formData.get('email') as string) ?? ''
  const password = (formData.get('password') as string) ?? ''
  const confirmPassword = (formData.get('confirm_password') as string) ?? ''
  const code = sanitizeInviteCode(formData.get('code') as string | null)

  const codeParam = code ? `&code=${code}` : ''

  if (!email || !password) {
    redirect(`/signup?error=Email+and+password+are+required${codeParam}`)
  }

  if (password.length < 6) {
    redirect(`/signup?error=Password+must+be+at+least+6+characters${codeParam}`)
  }

  if (password !== confirmPassword) {
    redirect(`/signup?error=Passwords+do+not+match${codeParam}`)
  }

  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3000'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const callbackUrl = code
    ? `${protocol}://${host}/auth/callback?type=signup&invite_code=${code}`
    : `${protocol}://${host}/auth/callback?type=signup`

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: callbackUrl } })

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}${codeParam}`)
  }

  // When Supabase requires email confirmation, session is null — prompt the user.
  if (!data.session) {
    redirect('/signup?message=Check+your+email+to+confirm+your+account')
  }

  await trackEvent(data.session.user.id, null, 'account_created')

  redirect(code ? `/onboarding?code=${code}` : '/onboarding')
}

export async function signOut() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect('/login')
}
