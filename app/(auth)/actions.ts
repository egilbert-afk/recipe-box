'use server'

import { createSupabaseServerClient } from '@/lib/supabase-server'
import { trackEvent } from '@/lib/events'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

export async function signIn(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    redirect('/login?error=Invalid+email+or+password')
  }

  redirect('/recipes')
}

export async function signUp(formData: FormData) {
  const email = (formData.get('email') as string) ?? ''
  const password = (formData.get('password') as string) ?? ''
  const confirmPassword = (formData.get('confirm_password') as string) ?? ''

  if (!email || !password) {
    redirect('/signup?error=Email+and+password+are+required')
  }

  if (password.length < 6) {
    redirect('/signup?error=Password+must+be+at+least+6+characters')
  }

  if (password !== confirmPassword) {
    redirect('/signup?error=Passwords+do+not+match')
  }

  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3000'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const emailRedirectTo = `${protocol}://${host}/auth/callback?type=signup`

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo } })

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`)
  }

  // When Supabase requires email confirmation, session is null — prompt the user.
  if (!data.session) {
    redirect('/signup?message=Check+your+email+to+confirm+your+account')
  }

  await trackEvent(data.session.user.id, null, 'account_created')

  redirect('/onboarding')
}

export async function signOut() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect('/login')
}
