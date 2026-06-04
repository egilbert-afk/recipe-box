import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type EventRow = {
  id: string
  user_id: string
  household_id: string | null
  event_name: string
  properties: Record<string, unknown>
  created_at: string
}

export default async function AdminPage() {
  const serverClient = await createSupabaseServerClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) redirect('/login')

  const { data: events } = await supabase
    .from('events')
    .select('*')
    .order('created_at', { ascending: false })

  const rows = (events ?? []) as EventRow[]

  const thisWeek = rows.filter(e => {
    const d = new Date(e.created_at)
    const now = new Date()
    return now.getTime() - d.getTime() < 7 * 24 * 60 * 60 * 1000
  })

  const countBy = (key: keyof EventRow) =>
    rows.reduce<Record<string, number>>((acc, e) => {
      const val = String(e[key] ?? 'unknown')
      acc[val] = (acc[val] ?? 0) + 1
      return acc
    }, {})

  const byEvent = countBy('event_name')
  const byUser = countBy('user_id')

  return (
    <div className="min-h-screen bg-white px-4 py-8 max-w-2xl mx-auto space-y-10">
      <h1 className="text-2xl font-semibold">Analytics</h1>

      <section className="space-y-1">
        <p className="text-gray-500 text-sm">Total events</p>
        <p className="text-4xl font-semibold">{rows.length}</p>
        <p className="text-sm text-gray-400">{thisWeek.length} this week</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">By event</h2>
        <ul className="divide-y divide-gray-100">
          {Object.entries(byEvent).sort((a, b) => b[1] - a[1]).map(([name, count]) => (
            <li key={name} className="flex justify-between py-2 text-sm">
              <span className="font-mono text-gray-700">{name}</span>
              <span className="font-semibold">{count}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">By user</h2>
        <ul className="divide-y divide-gray-100">
          {Object.entries(byUser).sort((a, b) => b[1] - a[1]).map(([userId, count]) => (
            <li key={userId} className="flex justify-between py-2 text-sm">
              <span className="font-mono text-gray-400 truncate max-w-xs">{userId}</span>
              <span className="font-semibold">{count}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Recent events</h2>
        <ul className="divide-y divide-gray-100">
          {rows.slice(0, 20).map(e => (
            <li key={e.id} className="py-3 space-y-0.5">
              <div className="flex justify-between text-sm">
                <span className="font-mono font-medium">{e.event_name}</span>
                <span className="text-gray-400 text-xs">
                  {new Date(e.created_at).toLocaleString()}
                </span>
              </div>
              {Object.keys(e.properties).length > 0 && (
                <p className="text-xs text-gray-400 font-mono">
                  {JSON.stringify(e.properties)}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
