import { createBrowserClient } from '@supabase/ssr'

// Browser-side Supabase client for client components (e.g. sign-out button).
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
