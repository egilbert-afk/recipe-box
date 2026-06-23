import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn() },
}))

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: vi.fn(),
}))

vi.mock('@/lib/events', () => ({
  VALID_EVENTS: [
    'account_created',
    'household_created',
    'household_joined',
    'recipe_added',
    'cooking_mode_started',
    'search_performed',
  ],
  trackEvent: vi.fn(),
}))

import { POST } from '@/app/api/events/route'
import { supabase } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'

const mockFrom = vi.mocked(supabase.from)
const mockServerClient = vi.mocked(createSupabaseServerClient)

function authAs(userId: string) {
  mockServerClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } } }) },
  } as never)
}

// Chain for household_members lookup: .select().eq().limit().maybeSingle()
function makeMembershipChain(result = { data: { household_id: 'hh-1' }, error: null } as { data: { household_id: string } | null; error: { message: string } | null }) {
  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'limit']) chain[m] = vi.fn().mockReturnValue(chain)
  chain.maybeSingle = vi.fn().mockResolvedValue(result)
  return chain
}

// Chain for events insert: .insert()
function makeInsertChain(result = { error: null } as { error: { message: string } | null }) {
  return { insert: vi.fn().mockResolvedValue(result) }
}

function makeRequest(body: object) {
  return new NextRequest('http://localhost/api/events', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

let membershipChain: ReturnType<typeof makeMembershipChain>
let insertChain: ReturnType<typeof makeInsertChain>

beforeEach(() => {
  vi.clearAllMocks()
  authAs('user-1')
  membershipChain = makeMembershipChain()
  insertChain = makeInsertChain()
  mockFrom.mockImplementation((table: string) =>
    (table === 'household_members' ? membershipChain : insertChain) as never
  )
})

describe('POST /api/events', () => {
  it('returns 401 when unauthenticated', async () => {
    mockServerClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    } as never)

    const res = await POST(makeRequest({ event_name: 'recipe_added' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for an unrecognised event name', async () => {
    const res = await POST(makeRequest({ event_name: 'hacked_event' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Invalid event name' })
  })

  it('returns 400 when event_name is missing', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Invalid event name' })
  })

  it('returns 201 for a valid event', async () => {
    const res = await POST(makeRequest({ event_name: 'recipe_added', properties: { capture_method: 'url' } }))
    expect(res.status).toBe(201)
  })

  it('looks up household_id server-side and uses it in the insert', async () => {
    membershipChain = makeMembershipChain({ data: { household_id: 'hh-abc' }, error: null })
    mockFrom.mockImplementation((table: string) =>
      (table === 'household_members' ? membershipChain : insertChain) as never
    )

    await POST(makeRequest({ event_name: 'cooking_mode_started', properties: { recipe_id: 'r-1' } }))

    expect(insertChain.insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      household_id: 'hh-abc',
      event_name: 'cooking_mode_started',
      properties: { recipe_id: 'r-1' },
    })
  })

  it('ignores any household_id supplied in the request body', async () => {
    membershipChain = makeMembershipChain({ data: { household_id: 'server-hh' }, error: null })
    mockFrom.mockImplementation((table: string) =>
      (table === 'household_members' ? membershipChain : insertChain) as never
    )

    await POST(makeRequest({ event_name: 'recipe_added', household_id: 'spoofed-hh' } as object))

    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ household_id: 'server-hh' })
    )
  })

  it('inserts null household_id when the membership lookup finds no row', async () => {
    membershipChain = makeMembershipChain({ data: null, error: null })
    mockFrom.mockImplementation((table: string) =>
      (table === 'household_members' ? membershipChain : insertChain) as never
    )

    await POST(makeRequest({ event_name: 'account_created' }))

    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ household_id: null })
    )
  })

  it('still inserts the event with null household_id when the membership lookup errors', async () => {
    membershipChain = makeMembershipChain({ data: null, error: { message: 'DB error' } })
    mockFrom.mockImplementation((table: string) =>
      (table === 'household_members' ? membershipChain : insertChain) as never
    )

    const res = await POST(makeRequest({ event_name: 'cooking_mode_started' }))

    expect(res.status).toBe(201)
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ household_id: null })
    )
  })

  it('logs an error when the membership lookup fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    membershipChain = makeMembershipChain({ data: null, error: { message: 'lookup failed' } })
    mockFrom.mockImplementation((table: string) =>
      (table === 'household_members' ? membershipChain : insertChain) as never
    )

    await POST(makeRequest({ event_name: 'cooking_mode_started' }))

    expect(consoleSpy).toHaveBeenCalledWith('[api/events] household lookup failed:', 'lookup failed')
    consoleSpy.mockRestore()
  })

  it('returns 500 when the insert fails', async () => {
    insertChain = makeInsertChain({ error: { message: 'DB error' } })
    mockFrom.mockImplementation((table: string) =>
      (table === 'household_members' ? membershipChain : insertChain) as never
    )

    const res = await POST(makeRequest({ event_name: 'recipe_added' }))
    expect(res.status).toBe(500)
  })
})
