const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// The browser sends its own local YYYY-MM-DD (the server runs in UTC and
// can't know the user's day). Same loose sanity bound as
// /api/habits/complete: a real date within 2 days of the server's UTC date.
export function isPlausibleClientDate(date: unknown): date is string {
  if (typeof date !== 'string' || !DATE_RE.test(date)) return false
  const client = new Date(`${date}T00:00:00Z`).getTime()
  const server = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`).getTime()
  return !Number.isNaN(client) && Math.abs(Math.round((client - server) / 86400000)) <= 2
}
