import { describe, it, expect } from 'vitest'
import { sanitizeShareToken, sanitizeInviteCode, isPublicRecipeUrl } from '@/lib/utils'

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

describe('isPublicRecipeUrl', () => {
  it('returns false for null', () => {
    expect(isPublicRecipeUrl(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isPublicRecipeUrl(undefined)).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isPublicRecipeUrl('')).toBe(false)
  })

  it('returns false for an invalid URL', () => {
    expect(isPublicRecipeUrl('not a url')).toBe(false)
  })

  it('returns false for a non-http protocol', () => {
    expect(isPublicRecipeUrl('ftp://recipes.example.com/pasta')).toBe(false)
  })

  it('returns true for a known public recipe site', () => {
    expect(isPublicRecipeUrl('https://www.seriouseats.com/pasta-recipe')).toBe(true)
  })

  it('returns true for a food blog', () => {
    expect(isPublicRecipeUrl('https://smittenkitchen.com/2024/01/pasta')).toBe(true)
  })

  it('returns false for a Google Docs link', () => {
    expect(isPublicRecipeUrl('https://docs.google.com/document/d/abc123/edit')).toBe(false)
  })

  it('returns false for a Google Drive link', () => {
    expect(isPublicRecipeUrl('https://drive.google.com/file/d/abc123/view')).toBe(false)
  })

  it('returns false for a Notion link', () => {
    expect(isPublicRecipeUrl('https://notion.so/my-recipe-abc123')).toBe(false)
  })

  it('returns false for a Dropbox link', () => {
    expect(isPublicRecipeUrl('https://www.dropbox.com/scl/fi/abc123/recipe.pdf')).toBe(false)
  })

  it('returns false for localhost', () => {
    expect(isPublicRecipeUrl('http://localhost:3000/recipe')).toBe(false)
  })

  it('returns false for a private IP address', () => {
    expect(isPublicRecipeUrl('http://192.168.1.1/recipe')).toBe(false)
  })

  it('returns true for an http (non-https) public site', () => {
    expect(isPublicRecipeUrl('http://www.simplyrecipes.com/pasta')).toBe(true)
  })

  it('returns false for a subdomain of a private domain', () => {
    expect(isPublicRecipeUrl('https://myworkspace.sharepoint.com/sites/recipes')).toBe(false)
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
