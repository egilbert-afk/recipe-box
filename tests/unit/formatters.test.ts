import { describe, it, expect } from 'vitest'
import { capitalize, formatIngredient, sortTitle } from '@/lib/formatters'

describe('sortTitle', () => {
  it('strips a leading "The " before sorting', () => {
    expect(sortTitle('The Godfather')).toBe('godfather')
  })

  it('strips case-insensitively', () => {
    expect(sortTitle('THE Best Chili')).toBe('best chili')
  })

  it('does not strip "The" without a trailing space', () => {
    expect(sortTitle('Theorem Soup')).toBe('theorem soup')
  })

  it('lowercases titles without a leading "The"', () => {
    expect(sortTitle('Pasta Carbonara')).toBe('pasta carbonara')
  })

  it('sorts "The X" before a title starting with a later letter', () => {
    const titles = ['Zucchini Bread', 'The Apple Cake', 'Banana Muffins']
    const sorted = [...titles].sort((a, b) => sortTitle(a).localeCompare(sortTitle(b)))
    expect(sorted).toEqual(['The Apple Cake', 'Banana Muffins', 'Zucchini Bread'])
  })
})

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
