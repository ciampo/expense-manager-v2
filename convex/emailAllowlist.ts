export function parseAllowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

/**
 * Check whether an email is permitted by the allowlist.
 * An empty allowlist means "allow all" (no filtering).
 * Entries starting with `*@` match by domain suffix; others are exact matches.
 * All comparisons are case-insensitive.
 */
export function isEmailAllowed(email: string | undefined, allowedEmails: string[]): boolean {
  if (allowedEmails.length === 0) return true
  if (!email) return false
  const normalized = email.toLowerCase()
  return allowedEmails.some((entry) =>
    entry.startsWith('*@') ? normalized.endsWith(entry.slice(1)) : normalized === entry,
  )
}
