import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { InviteCode } from '@/components/InviteCode'

export const dynamic = 'force-dynamic'

export default async function HouseholdPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id, role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) redirect('/onboarding')

  const { data: household } = await supabase
    .from('households')
    .select('id, name, plan, is_beta, invite_code')
    .eq('id', membership.household_id)
    .single()

  if (!household) redirect('/onboarding')

  const { data: members } = await supabase
    .from('household_members')
    .select('user_id, role, joined_at')
    .eq('household_id', membership.household_id)

  const isOwner = membership.role === 'owner'

  return (
    <main className="max-w-lg mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold">{household.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {household.plan === 'free' ? 'Free plan' : 'Paid plan'}
            {household.is_beta && ' · Beta'}
          </p>
        </div>
        <Link href="/recipes" className="text-sm text-gray-500 underline">
          Back to recipes
        </Link>
      </div>

      {isOwner && (
        <section className="mb-10">
          <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
            Invite code
          </h2>
          <InviteCode initialCode={household.invite_code} />
        </section>
      )}

      <section>
        <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
          Members
        </h2>
        <ul className="divide-y divide-gray-100">
          {(members ?? []).map(m => (
            <li key={m.user_id} className="flex items-center justify-between py-3">
              <span className="text-sm text-gray-700 font-mono">
                {m.user_id.slice(0, 8)}…
              </span>
              <span className="text-xs text-gray-400 capitalize">{m.role}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
