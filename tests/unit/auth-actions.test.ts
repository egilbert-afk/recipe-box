import { describe, it, expect, vi, beforeEach } from 'vitest'
import { signIn, signOut, signUp, signInWithGoogle } from '@/app/(auth)/actions'

// redirect() throws internally in Next.js — we replicate that here so the
// function under test stops executing at the redirect call, just as it would
// in a real server environment.
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))

vi.mock('next/headers', () => ({
  headers: vi.fn(() => Promise.resolve(new Headers({ host: 'example.com' }))),
}))

const mockSignInWithPassword = vi.fn()
const mockSignOut = vi.fn()
const mockSignUp = vi.fn()
const mockSignInWithOAuth = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: vi.fn(() =>
    Promise.resolve({
      auth: {
        signInWithPassword: mockSignInWithPassword,
        signOut: mockSignOut,
        signUp: mockSignUp,
        signInWithOAuth: mockSignInWithOAuth,
      },
    })
  ),
}))

vi.mock('@/lib/events', () => ({
  trackEvent: vi.fn(),
  VALID_EVENTS: [],
}))

function makeFormData(fields: Record<string, string>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('signIn', () => {
  it('redirects to /recipes on successful login', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null })

    await expect(
      signIn(makeFormData({ email: 'user@example.com', password: 'secret' }))
    ).rejects.toThrow('REDIRECT:/recipes')
  })

  it('redirects to /login with error on auth failure', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } })

    await expect(
      signIn(makeFormData({ email: 'user@example.com', password: 'wrong' }))
    ).rejects.toThrow('REDIRECT:/login?error=Invalid+email+or+password')
  })

  it('passes email and password to signInWithPassword', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null })

    await expect(
      signIn(makeFormData({ email: 'chef@example.com', password: 'mypassword' }))
    ).rejects.toThrow()

    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'chef@example.com',
      password: 'mypassword',
    })
  })
})

describe('signInWithGoogle', () => {
  it('redirects to the provider URL Supabase returns', async () => {
    mockSignInWithOAuth.mockResolvedValue({ data: { url: 'https://accounts.google.com/o/oauth2/auth?foo=bar' }, error: null })

    await expect(signInWithGoogle(makeFormData({}))).rejects.toThrow(
      'REDIRECT:https://accounts.google.com/o/oauth2/auth?foo=bar'
    )
  })

  it('requests the google provider with a callback redirectTo', async () => {
    mockSignInWithOAuth.mockResolvedValue({ data: { url: 'https://accounts.google.com/authorize' }, error: null })

    await expect(signInWithGoogle(makeFormData({}))).rejects.toThrow()

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'https://example.com/auth/callback?type=oauth' },
    })
  })

  it('carries an invite code through to the callback redirectTo', async () => {
    mockSignInWithOAuth.mockResolvedValue({ data: { url: 'https://accounts.google.com/authorize' }, error: null })

    await expect(signInWithGoogle(makeFormData({ code: 'abcd1234' }))).rejects.toThrow()

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'https://example.com/auth/callback?type=oauth&invite_code=ABCD1234' },
    })
  })

  it('redirects to /login with an error when Supabase fails to start the OAuth flow', async () => {
    mockSignInWithOAuth.mockResolvedValue({ data: { url: null }, error: { message: 'provider not configured' } })

    await expect(signInWithGoogle(makeFormData({}))).rejects.toThrow('REDIRECT:/login?error=')
  })
})

describe('signOut', () => {
  it('calls supabase signOut and redirects to /login', async () => {
    mockSignOut.mockResolvedValue({})

    await expect(signOut()).rejects.toThrow('REDIRECT:/login')

    expect(mockSignOut).toHaveBeenCalledOnce()
  })
})

describe('signUp', () => {
  it('redirects to /signup with error when email is missing', async () => {
    await expect(
      signUp(makeFormData({ email: '', password: 'password123', confirm_password: 'password123' }))
    ).rejects.toThrow('REDIRECT:/signup?error=')
  })

  it('redirects to /signup with error when password is too short', async () => {
    await expect(
      signUp(makeFormData({ email: 'user@example.com', password: '12345', confirm_password: '12345' }))
    ).rejects.toThrow('REDIRECT:/signup?error=')
  })

  it('redirects to /signup with error when passwords do not match', async () => {
    await expect(
      signUp(makeFormData({ email: 'user@example.com', password: 'password123', confirm_password: 'different' }))
    ).rejects.toThrow('REDIRECT:/signup?error=')
  })

  it('redirects to /onboarding on successful signup with a session', async () => {
    mockSignUp.mockResolvedValue({ data: { session: { access_token: 'tok', user: { id: 'user-123' } } }, error: null })

    await expect(
      signUp(makeFormData({ email: 'user@example.com', password: 'password123', confirm_password: 'password123' }))
    ).rejects.toThrow('REDIRECT:/onboarding')
  })

  it('redirects to /signup with a confirmation message when Supabase returns no session', async () => {
    mockSignUp.mockResolvedValue({ data: { session: null }, error: null })

    await expect(
      signUp(makeFormData({ email: 'user@example.com', password: 'password123', confirm_password: 'password123' }))
    ).rejects.toThrow('REDIRECT:/signup?message=')
  })

  it('redirects to /signup with error when Supabase returns an error', async () => {
    mockSignUp.mockResolvedValue({ data: null, error: { message: 'User already registered' } })

    await expect(
      signUp(makeFormData({ email: 'user@example.com', password: 'password123', confirm_password: 'password123' }))
    ).rejects.toThrow('REDIRECT:/signup?error=')
  })
})
