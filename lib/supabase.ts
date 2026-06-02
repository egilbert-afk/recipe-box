import 'server-only'
import { createClient } from '@supabase/supabase-js'

// Service role client for server-side API routes — bypasses RLS.
// Never import this in client components or expose to the browser.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
