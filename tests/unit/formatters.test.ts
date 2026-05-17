import { describe, it, expect } from 'vitest'
import { capitalize, formatIngredient } from '@/lib/formatters'

describe('capitalize', () => {
  it('capitalizes first letter', () => {
    expect(capitalize('hello')).toBe('Hello')
  })

  it('handles already-capitalized strings', () => {
    expect(capitalize('Hello')).toBe('Hello')
  })

  it('returns empty string for empty input', () => {
    expect(capitalize('')).toBe('')
  })
})

describe('formatIngredient', () => {
  it('formats with amount and unit', () => {
    expect(formatIngredient('flour', '2', 'cups')).toBe('2 cups flour')
  })

  it('formats with amount but no unit', () => {
    expect(formatIngredient('eggs', '2', null)).toBe('2 eggs')
  })

  it('returns just the name when amount is empty', () => {
    expect(formatIngredient('salt', '', null)).toBe('salt')
  })
})
