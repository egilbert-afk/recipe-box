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

function makeChain(result = { error: null }) {
  const chain: Record<string, unknown> = {}
  const methods = ['insert', 'select', 'eq', 'single']
  for (const m of methods) chain[m] = vi.fn().mockReturnValue(chain)
  ;(chain.insert as ReturnType<typeof vi.fn>).mockResolvedValue(result)
  return chain
}

function makeRequest(body: object) {
  return new NextRequest('http://localhost/api/events', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  authAs('user-1')
  mockFrom.mockReturnValue(makeChain() as never)
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

  it('inserts the correct fields', async () => {
    const chain = makeChain()
    mockFrom.mockReturnValue(chain as never)

    await POST(makeRequest({
      event_name: 'recipe_added',
      household_id: 'hh-1',
      properties: { capture_method: 'manual' },
    }))

    expect(chain.insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      household_id: 'hh-1',
      event_name: 'recipe_added',
      properties: { capture_method: 'manual' },
    })
  })

  it('defaults household_id to null when not provided', async () => {
    const chain = makeChain()
    mockFrom.mockReturnValue(chain as never)

    await POST(makeRequest({ event_name: 'account_created' }))

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ household_id: null })
    )
  })

  it('returns 500 when the insert fails', async () => {
    mockFrom.mockReturnValue(makeChain({ error: { message: 'DB error' } }) as never)

    const res = await POST(makeRequest({ event_name: 'recipe_added' }))
    expect(res.status).toBe(500)
  })
})
