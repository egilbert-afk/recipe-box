import { describe, it, expect } from 'vitest'
import { parseSearchQuery } from '@/lib/search'

describe('parseSearchQuery', () => {
  it('returns a single term unchanged', () => {
    expect(parseSearchQuery('chicken')).toBe('chicken')
  })

  it('joins multiple terms with OR logic', () => {
    expect(parseSearchQuery('chicken lemon')).toBe('chicken | lemon')
  })

  it('strips the word "and" so it is not treated as a search term', () => {
    expect(parseSearchQuery('chicken and lemon')).toBe('chicken | lemon')
  })

  it('strips other stopwords', () => {
    expect(parseSearchQuery('a chicken with lemon')).toBe('chicken | lemon')
  })

  it('returns empty string when input is only stopwords', () => {
    expect(parseSearchQuery('the and or')).toBe('')
  })

  it('returns empty string for blank input', () => {
    expect(parseSearchQuery('   ')).toBe('')
  })

  it('lowercases terms', () => {
    expect(parseSearchQuery('Chicken LEMON')).toBe('chicken | lemon')
  })

  it('strips special characters', () => {
    expect(parseSearchQuery('chicken! lemon?')).toBe('chicken | lemon')
  })

  it('filters out single-character terms', () => {
    expect(parseSearchQuery('a b chicken')).toBe('chicken')
  })

  it('splits hyphenated words into separate terms', () => {
    expect(parseSearchQuery('sun-dried tomato')).toBe('sun | dried | tomato')
  })
})
