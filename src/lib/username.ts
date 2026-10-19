// Usernames for "username + password" sign-in (migration 055). Stored
// lowercase; must match the database CHECK constraint.

const USERNAME_RE = /^[a-z0-9][a-z0-9._]{1,28}[a-z0-9]$/

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/^@/, '')
}

export function usernameProblem(raw: string): string | null {
  const u = normalizeUsername(raw)
  if (u.length < 3) return 'At least 3 characters'
  if (u.length > 30) return 'At most 30 characters'
  if (!USERNAME_RE.test(u)) return 'Letters, numbers, dots and underscores; start and end with a letter or number'
  return null
}

// A sign-in identifier with an @ (other than a leading one) is an email.
export function isEmailIdentifier(raw: string): boolean {
  return raw.trim().replace(/^@/, '').includes('@')
}
