import { describe, it, expect } from 'vitest'
import { sanitizeShareToken, sanitizeInviteCode } from '@/lib/utils'

describe('sanitizeShareToken', () => {
  it('returns null for null input', () => {
    expect(sanitizeShareToken(null)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(sanitizeShareToken('')).toBeNull()
  })

  it('accepts a valid lowercase UUID', () => {
    expect(sanitizeShareToken('550e8400-e29b-41d4-a716-446655440000'))
      .toBe('550e8400-e29b-41d4-a716-446655440000')
  })

  it('accepts a valid uppercase UUID and lowercases it', () => {
    expect(sanitizeShareToken('550E8400-E29B-41D4-A716-446655440000'))
      .toBe('550e8400-e29b-41d4-a716-446655440000')
  })

  it('returns null for a non-UUID string', () => {
    expect(sanitizeShareToken('not-a-uuid')).toBeNull()
  })

  it('returns null for a UUID wrapped in braces', () => {
    expect(sanitizeShareToken('{550e8400-e29b-41d4-a716-446655440000}')).toBeNull()
  })

  it('returns null for a UUID with extra trailing characters', () => {
    expect(sanitizeShareToken('550e8400-e29b-41d4-a716-446655440000extra')).toBeNull()
  })

  it('returns null for a SQL injection attempt', () => {
    expect(sanitizeShareToken("'; DROP TABLE recipes; --")).toBeNull()
  })
})

describe('sanitizeInviteCode', () => {
  it('returns null for null input', () => {
    expect(sanitizeInviteCode(null)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(sanitizeInviteCode('')).toBeNull()
  })

  it('accepts a valid 8-character alphanumeric code', () => {
    expect(sanitizeInviteCode('A1B2C3D4')).toBe('A1B2C3D4')
  })

  it('uppercases a valid lowercase code', () => {
    expect(sanitizeInviteCode('a1b2c3d4')).toBe('A1B2C3D4')
  })

  it('returns null for a code that is too short', () => {
    expect(sanitizeInviteCode('A1B2C3')).toBeNull()
  })

  it('returns null for a code that is too long', () => {
    expect(sanitizeInviteCode('A1B2C3D4E5')).toBeNull()
  })

  it('returns null for a code with non-alphanumeric characters', () => {
    expect(sanitizeInviteCode('A1B2-C3D')).toBeNull()
  })
})
