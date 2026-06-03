import { describe, it, expect, vi, beforeEach } from 'vitest'
import { signIn, signOut } from '@/app/(auth)/actions'

// redirect() throws internally in Next.js — we replicate that here so the
// function under test stops executing at the redirect call, just as it would
// in a real server environment.
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))

const mockSignInWithPassword = vi.fn()
const mockSignOut = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: vi.fn(() =>
    Promise.resolve({
      auth: {
        signInWithPassword: mockSignInWithPassword,
        signOut: mockSignOut,
      },
    })
  ),
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

describe('signOut', () => {
  it('calls supabase signOut and redirects to /login', async () => {
    mockSignOut.mockResolvedValue({})

    await expect(signOut()).rejects.toThrow('REDIRECT:/login')

    expect(mockSignOut).toHaveBeenCalledOnce()
  })
})
