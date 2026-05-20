// Words to ignore when building a search query — searching "chicken and lemon"
// should find chicken OR lemon, not "and"
const STOPWORDS = new Set(['and', 'or', 'with', 'a', 'an', 'the', 'of', 'in', 'on', 'for'])

// Converts a free-text user input into a PostgreSQL tsquery string using OR logic.
// Returns an empty string if no meaningful terms remain after filtering.
//
// Examples:
//   "chicken lemon"  → "chicken | lemon"
//   "chicken and lemon" → "chicken | lemon"
//   "the"            → ""
export function parseSearchQuery(input: string): string {
  const terms = input
    .toLowerCase()
    .replace(/-/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))

  if (terms.length === 0) return ''
  return terms.join(' | ')
}
