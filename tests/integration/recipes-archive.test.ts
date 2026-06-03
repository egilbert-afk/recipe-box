import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { PATCH } from '@/app/api/recipes/[id]/route'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

import { supabase } from '@/lib/supabase'

function mockChain(result: object) {
  const chain = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
  }
  vi.mocked(supabase.from).mockReturnValue(chain as never)
  return chain
}

function makeRequest(id: string, body: object) {
  return new NextRequest(`http://localhost/api/recipes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PATCH /api/recipes/[id] — validation', () => {
  it('returns 400 when archived is not a boolean', async () => {
    const req = makeRequest('abc-123', { archived: 'yes' })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'abc-123' }) })
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'archived must be a boolean' })
  })

  it('returns 400 when archive_note exceeds 500 characters', async () => {
    const req = makeRequest('abc-123', { archived: true, archive_note: 'x'.repeat(501) })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'abc-123' }) })
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Archive note must be 500 characters or fewer' })
  })

  it('returns 400 for invalid JSON', async () => {
    const req = new NextRequest('http://localhost/api/recipes/abc-123', {
      method: 'PATCH',
      body: 'not-json',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'abc-123' }) })
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Invalid JSON' })
  })
})

describe('PATCH /api/recipes/[id] — archive', () => {
  it('archives a recipe with a note', async () => {
    const fakeResult = { id: 'abc-123', title: 'Pasta', archived: true, archive_note: 'Too fussy' }
    mockChain({ data: fakeResult, error: null })

    const req = makeRequest('abc-123', { archived: true, archive_note: 'Too fussy' })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'abc-123' }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ archived: true, archive_note: 'Too fussy' })
  })

  it('archives a recipe without a note', async () => {
    const fakeResult = { id: 'abc-123', title: 'Pasta', archived: true, archive_note: null }
    const chain = mockChain({ data: fakeResult, error: null })

    const req = makeRequest('abc-123', { archived: true })
    await PATCH(req, { params: Promise.resolve({ id: 'abc-123' }) })

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ archived: true, archive_note: null })
    )
  })
})

describe('PATCH /api/recipes/[id] — restore', () => {
  it('restores a recipe and clears the note', async () => {
    const fakeResult = { id: 'abc-123', title: 'Pasta', archived: false, archive_note: null }
    const chain = mockChain({ data: fakeResult, error: null })

    const req = makeRequest('abc-123', { archived: false, archive_note: 'ignored' })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'abc-123' }) })

    expect(res.status).toBe(200)
    // Note is always cleared on restore regardless of what was sent
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ archived: false, archive_note: null })
    )
  })

  it('returns 404 when recipe is not found', async () => {
    mockChain({ data: null, error: { code: 'PGRST116', message: 'Not found' } })

    const req = makeRequest('nonexistent', { archived: false })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'nonexistent' }) })

    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ error: 'Recipe not found' })
  })

  it('returns 500 on database error', async () => {
    mockChain({ data: null, error: { code: '23505', message: 'DB error' } })

    const req = makeRequest('abc-123', { archived: false })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'abc-123' }) })

    expect(res.status).toBe(500)
  })
})
