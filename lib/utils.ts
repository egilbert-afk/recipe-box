// Domains that are typically private or require auth. URLs from these hosts are
// excluded from the Discover pool by default. Users can override per-recipe.
const PRIVATE_DOMAINS = [
  'docs.google.com',
  'drive.google.com',
  'mail.google.com',
  'sheets.google.com',
  'slides.google.com',
  'notion.so',
  'airtable.com',
  'sharepoint.com',
  'confluence.atlassian.com',
  'dropbox.com',
  'onedrive.live.com',
  'icloud.com',
  'trello.com',
  'basecamp.com',
  'evernote.com',
]

// Returns true if the URL is from a publicly accessible source that can be
// shared via Discover. Returns false for known private or ambiguous hosts,
// non-http(s) URLs, and invalid URLs. Safe to call with any user-supplied string.
export function isPublicRecipeUrl(url: string | null | undefined): boolean {
  if (!url) return false
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
  const host = parsed.hostname.toLowerCase()
  if (host === 'localhost' || /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(host)) {
    return false
  }
  return !PRIVATE_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`))
}

// Invite codes are exactly 8 uppercase alphanumeric characters.
// Validate before interpolating into URLs to prevent parameter injection.
export function sanitizeInviteCode(value: string | null): string | null {
  if (!value) return null
  return /^[A-Z0-9]{8}$/.test(value.toUpperCase()) ? value.toUpperCase() : null
}

// Share tokens are UUIDs. Validate before interpolating into URLs.
export function sanitizeShareToken(value: string | null): string | null {
  if (!value) return null
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    ? value.toLowerCase()
    : null
}
