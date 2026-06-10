import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>
}) {
  const { code } = await searchParams

  if (!code) {
    return <InvalidInvite />
  }

  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: household } = await serviceClient
    .from('households')
    .select('name')
    .eq('invite_code', code.toUpperCase())
    .maybeSingle()

  if (!household) {
    return <InvalidInvite />
  }

  // Check if the visitor is already logged in
  const serverClient = await createSupabaseServerClient()
  const { data: { user } } = await serverClient.auth.getUser()

  if (user) {
    const { data: membership } = await serviceClient
      .from('household_members')
      .select('household_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (membership) {
      return (
        <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-white">
          <div className="w-full max-w-sm text-center space-y-4">
            <h1 className="text-2xl font-semibold">You're already in a kitchen</h1>
            <p className="text-gray-500 text-sm">
              You can only belong to one kitchen at a time. You'd need to leave your current kitchen first.
            </p>
            <Link
              href="/recipes"
              className="block w-full h-12 rounded-full bg-black text-white text-sm font-medium flex items-center justify-center"
            >
              Go to my kitchen
            </Link>
          </div>
        </main>
      )
    }

    // Logged in, no household — accept directly via onboarding
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-white">
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="space-y-2">
            <p className="text-sm text-gray-500">You've been invited to join</p>
            <h1 className="text-2xl font-semibold">{household.name}</h1>
          </div>
          <Link
            href={`/onboarding?code=${code.toUpperCase()}`}
            className="block w-full h-12 rounded-full bg-black text-white text-sm font-medium flex items-center justify-center"
          >
            Accept invite
          </Link>
        </div>
      </main>
    )
  }

  // Not logged in — route to signup with code preserved
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-white">
      <div className="w-full max-w-sm text-center space-y-6">
        <div className="space-y-2">
          <p className="text-sm text-gray-500">You've been invited to join</p>
          <h1 className="text-2xl font-semibold">{household.name}</h1>
        </div>
        <div className="space-y-3">
          <Link
            href={`/signup?code=${code.toUpperCase()}`}
            className="block w-full h-12 rounded-full bg-black text-white text-sm font-medium flex items-center justify-center"
          >
            Accept invite
          </Link>
          <p className="text-sm text-gray-500">
            Already have an account?{' '}
            <Link href={`/login?code=${code.toUpperCase()}`} className="text-gray-900 underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}

function InvalidInvite() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-white">
      <div className="w-full max-w-sm text-center space-y-4">
        <h1 className="text-2xl font-semibold">Invalid invite link</h1>
        <p className="text-gray-500 text-sm">
          This invite link is invalid or has expired. Ask the kitchen owner to send you a new one.
        </p>
      </div>
    </main>
  )
}
