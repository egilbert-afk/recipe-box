import 'server-only'
import { headers } from 'next/headers'

export type AuthCallbackType = 'signup' | 'recovery' | 'oauth'

// Builds the /auth/callback URL used for email confirmation, password recovery, and OAuth
// sign-in, so the "http for localhost, https otherwise" heuristic only needs to live in one
// place instead of being copied at every call site.
export async function buildAuthCallbackUrl(type: AuthCallbackType, params: Record<string, string> = {}) {
  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3000'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const query = new URLSearchParams({ type, ...params })
  return `${protocol}://${host}/auth/callback?${query.toString()}`
}
