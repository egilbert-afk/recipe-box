// Returns a scaled ingredient amount given a base and target serving count.
// Returns null if the original amount is null (e.g. "salt to taste").
export function scaleAmount(
  amount: number | null,
  baseServings: number,
  targetServings: number
): number | null {
  if (amount === null) return null
  if (baseServings <= 0 || targetServings <= 0) return amount
  return (amount * targetServings) / baseServings
}

// Converts a decimal to a display-friendly fraction string where possible.
// Handles halves, quarters, thirds, and three-quarters.
// Falls back to a rounded decimal for anything else.
export function toFraction(value: number): string {
  if (value <= 0) return String(value)

  const whole = Math.floor(value)
  const decimal = value - whole
  const prefix = whole > 0 ? `${whole} ` : ''

  if (decimal === 0) return String(whole)
  if (Math.abs(decimal - 0.5) < 0.01) return `${prefix}½`
  if (Math.abs(decimal - 0.25) < 0.01) return `${prefix}¼`
  if (Math.abs(decimal - 0.75) < 0.01) return `${prefix}¾`
  if (Math.abs(decimal - 1 / 3) < 0.01) return `${prefix}⅓`
  if (Math.abs(decimal - 2 / 3) < 0.01) return `${prefix}⅔`

  // Fall back to one decimal place for anything we can't express as a fraction
  return String(Math.round(value * 10) / 10)
}

// Formats a scaled ingredient amount for display.
// Returns an empty string if amount is null.
export function formatAmount(
  amount: number | null,
  baseServings: number,
  targetServings: number
): string {
  const scaled = scaleAmount(amount, baseServings, targetServings)
  if (scaled === null) return ''
  return toFraction(scaled)
}
