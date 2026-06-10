import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabase } from '@/lib/supabase'
import { KitchenNameEditor } from './KitchenNameEditor'
import { InviteCode } from './InviteCode'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const serverClient = await createSupabaseServerClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id, role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) redirect('/onboarding')

  const { data: household } = await supabase
    .from('households')
    .select('name, invite_code')
    .eq('id', membership.household_id)
    .single()

  if (!household) redirect('/recipes')

  const { data: members } = await supabase
    .from('household_members')
    .select('user_id, role, joined_at')
    .eq('household_id', membership.household_id)
    .order('joined_at', { ascending: true })

  // Fetch emails for all members via the admin API
  const memberDetails = await Promise.all(
    (members ?? []).map(async (m) => {
      const { data: { user: u } } = await supabase.auth.admin.getUserById(m.user_id)
      return { ...m, email: u?.email ?? m.user_id }
    })
  )

  const isOwner = membership.role === 'owner'

  return (
    <div className="min-h-screen bg-white pb-20">
      <header className="flex items-center gap-3 px-4 py-4 border-b border-gray-200">
        <Link
          href="/recipes"
          className="flex items-center justify-center h-12 w-12 rounded-full text-gray-600 hover:bg-gray-100"
        >
          ←
        </Link>
        <h1 className="text-lg font-semibold">Kitchen Settings</h1>
      </header>

      <main className="px-4 py-6 space-y-8 max-w-lg">

        {/* Kitchen name */}
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Kitchen name</h2>
          {isOwner ? (
            <KitchenNameEditor initialName={household.name} />
          ) : (
            <p className="text-base text-gray-900">{household.name}</p>
          )}
        </section>

        {/* Invite code */}
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Invite code</h2>
          <InviteCode code={household.invite_code} kitchenName={household.name} />
        </section>

        {/* Members */}
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
            Members ({memberDetails.length})
          </h2>
          <ul className="divide-y divide-gray-100">
            {memberDetails.map((m) => (
              <li key={m.user_id} className="flex items-center justify-between py-3">
                <span className="text-sm text-gray-900">{m.email}</span>
                <span className="text-xs text-gray-400 capitalize">{m.role}</span>
              </li>
            ))}
          </ul>
        </section>

      </main>
    </div>
  )
}
