import Link from 'next/link'
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

type FeedbackRow = {
  id: string
  user_id: string
  message: string
  created_at: string
}

const EVENT_LABEL: Record<string, string> = {
  account_created: 'Account created',
  household_created: 'Kitchen created',
  household_joined: 'Kitchen joined',
  recipe_added: 'Recipe added',
  cooking_mode_started: 'Cooking mode started',
  search_performed: 'Search performed',
}

export default async function AdminPage() {
  const serverClient = await createSupabaseServerClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) redirect('/login')
  if (user.email !== process.env.ADMIN_EMAIL) redirect('/recipes')

  const [{ data: events }, { data: feedbackData }] = await Promise.all([
    supabase.from('events').select('*').order('created_at', { ascending: false }),
    supabase.from('feedback').select('*').order('created_at', { ascending: false }),
  ])

  const rows = (events ?? []) as EventRow[]
  const feedbackRows = (feedbackData ?? []) as FeedbackRow[]

  const now = new Date()
  const d7  = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000)
  const d14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const d60 = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

  function countByEvent(filter: (e: EventRow) => boolean): Record<string, number> {
    return rows.filter(filter).reduce<Record<string, number>>((acc, e) => {
      acc[e.event_name] = (acc[e.event_name] ?? 0) + 1
      return acc
    }, {})
  }

  const last7   = countByEvent(e => new Date(e.created_at) >= d7)
  const prior7  = countByEvent(e => new Date(e.created_at) >= d14 && new Date(e.created_at) < d7)
  const last30  = countByEvent(e => new Date(e.created_at) >= d30)
  const prior30 = countByEvent(e => new Date(e.created_at) >= d60 && new Date(e.created_at) < d30)
  const allTime = countByEvent(() => true)

  const eventNames = [...new Set(rows.map(e => e.event_name))].sort()

  const byUser = rows.reduce<Record<string, number>>((acc, e) => {
    acc[e.user_id] = (acc[e.user_id] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-white px-4 py-8 max-w-3xl mx-auto space-y-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <Link href="/recipes" className="text-sm text-gray-500 underline">
          Back to recipes
        </Link>
      </div>

      {/* Stats comparison table */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Events</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-100">
                <th className="pb-2 font-medium pr-4">Event</th>
                <th className="pb-2 font-medium text-right pr-4">Last 7d</th>
                <th className="pb-2 font-medium text-right pr-4">Prev 7d</th>
                <th className="pb-2 font-medium text-right pr-4">Last 30d</th>
                <th className="pb-2 font-medium text-right pr-4">Prev 30d</th>
                <th className="pb-2 font-medium text-right">All time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {eventNames.map(name => (
                <tr key={name}>
                  <td className="py-2 pr-4 text-gray-700">{EVENT_LABEL[name] ?? name}</td>
                  <td className="py-2 pr-4 text-right font-semibold">{last7[name] ?? 0}</td>
                  <td className="py-2 pr-4 text-right text-gray-400">{prior7[name] ?? 0}</td>
                  <td className="py-2 pr-4 text-right font-semibold">{last30[name] ?? 0}</td>
                  <td className="py-2 pr-4 text-right text-gray-400">{prior30[name] ?? 0}</td>
                  <td className="py-2 text-right font-semibold">{allTime[name] ?? 0}</td>
                </tr>
              ))}
              {eventNames.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-gray-400">No events yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* By user */}
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

      {/* Recent events */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Recent events</h2>
        <ul className="divide-y divide-gray-100">
          {rows.slice(0, 20).map(e => (
            <li key={e.id} className="py-3 space-y-0.5">
              <div className="flex justify-between text-sm">
                <span className="font-medium">{EVENT_LABEL[e.event_name] ?? e.event_name}</span>
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

      {/* Feedback */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
          Feedback ({feedbackRows.length})
        </h2>
        {feedbackRows.length === 0 ? (
          <p className="text-sm text-gray-400">No feedback yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {feedbackRows.map(f => (
              <li key={f.id} className="py-3 space-y-1">
                <p className="text-sm">{f.message}</p>
                <p className="text-xs text-gray-400">
                  {new Date(f.created_at).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
