import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn() },
}))

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: vi.fn(),
}))

import { POST } from '@/app/api/feedback/route'
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
  return new NextRequest('http://localhost/api/feedback', {
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

describe('POST /api/feedback', () => {
  it('returns 401 when unauthenticated', async () => {
    mockServerClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    } as never)

    const res = await POST(makeRequest({ message: 'Great app!' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when message is missing', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Message is required' })
  })

  it('returns 400 when message is blank whitespace', async () => {
    const res = await POST(makeRequest({ message: '   ' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Message is required' })
  })

  it('returns 400 when message exceeds 1000 characters', async () => {
    const res = await POST(makeRequest({ message: 'A'.repeat(1001) }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Message must be 1000 characters or fewer' })
  })

  it('returns 201 for a valid submission', async () => {
    const res = await POST(makeRequest({ message: 'The scaling feature is great!' }))
    expect(res.status).toBe(201)
  })

  it('inserts the correct fields', async () => {
    const chain = makeChain()
    mockFrom.mockReturnValue(chain as never)

    await POST(makeRequest({ message: 'Nice work', household_id: 'hh-1' }))

    expect(chain.insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      household_id: 'hh-1',
      message: 'Nice work',
    })
  })

  it('defaults household_id to null when not provided', async () => {
    const chain = makeChain()
    mockFrom.mockReturnValue(chain as never)

    await POST(makeRequest({ message: 'Good stuff' }))

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ household_id: null })
    )
  })

  it('trims whitespace from the message before inserting', async () => {
    const chain = makeChain()
    mockFrom.mockReturnValue(chain as never)

    await POST(makeRequest({ message: '  trim me  ' }))

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'trim me' })
    )
  })

  it('returns 500 when the insert fails', async () => {
    mockFrom.mockReturnValue(makeChain({ error: { message: 'DB error' } }) as never)

    const res = await POST(makeRequest({ message: 'Hello' }))
    expect(res.status).toBe(500)
  })
})
