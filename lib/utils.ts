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
