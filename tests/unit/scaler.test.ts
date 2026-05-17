import { describe, it, expect } from 'vitest'
import { scaleAmount, toFraction, formatAmount } from '@/lib/scaler'

describe('scaleAmount', () => {
  it('scales up correctly', () => {
    expect(scaleAmount(1, 2, 4)).toBe(2)
  })

  it('scales down correctly', () => {
    expect(scaleAmount(2, 4, 2)).toBe(1)
  })

  it('returns null when amount is null', () => {
    expect(scaleAmount(null, 4, 2)).toBeNull()
  })

  it('returns original amount when base and target are equal', () => {
    expect(scaleAmount(3, 4, 4)).toBe(3)
  })

  it('handles fractional results', () => {
    expect(scaleAmount(1, 4, 2)).toBe(0.5)
  })

  it('returns original amount when base servings is 0', () => {
    expect(scaleAmount(2, 0, 4)).toBe(2)
  })

  it('returns original amount when target servings is 0', () => {
    expect(scaleAmount(2, 4, 0)).toBe(2)
  })
})

describe('toFraction', () => {
  it('returns whole number as string', () => {
    expect(toFraction(2)).toBe('2')
  })

  it('converts 0.5 to ½', () => {
    expect(toFraction(0.5)).toBe('½')
  })

  it('converts 0.25 to ¼', () => {
    expect(toFraction(0.25)).toBe('¼')
  })

  it('converts 0.75 to ¾', () => {
    expect(toFraction(0.75)).toBe('¾')
  })

  it('converts 1/3 to ⅓', () => {
    expect(toFraction(1 / 3)).toBe('⅓')
  })

  it('converts 2/3 to ⅔', () => {
    expect(toFraction(2 / 3)).toBe('⅔')
  })

  it('combines whole number and fraction', () => {
    expect(toFraction(1.5)).toBe('1 ½')
    expect(toFraction(2.25)).toBe('2 ¼')
  })

  it('falls back to decimal for unrecognized fractions', () => {
    expect(toFraction(0.1)).toBe('0.1')
    expect(toFraction(0.3)).toBe('0.3')
  })
})

describe('formatAmount', () => {
  it('returns empty string for null amount', () => {
    expect(formatAmount(null, 4, 4)).toBe('')
  })

  it('scales and formats correctly', () => {
    expect(formatAmount(2, 4, 2)).toBe('1')
    expect(formatAmount(1, 4, 2)).toBe('½')
  })
})
