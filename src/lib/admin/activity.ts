// "Last activity" for the admin pages: the newest thing a user did across
// the app (points log, habits, meals, workouts, spending, journal, check-ins,
// sleep, water) or their last sign-in, whichever is later.

export interface ActivityEvent { user_id: string; at: string; label: string }

export type ActivityStatus = 'today' | 'week' | 'month' | 'dormant' | 'never'

const HOUR = 3_600_000, DAY = 24 * HOUR

export function latestByUser(events: readonly ActivityEvent[]): Map<string, ActivityEvent> {
  const out = new Map<string, ActivityEvent>()
  for (const e of events) {
    if (!e.at) continue
    const cur = out.get(e.user_id)
    if (!cur || new Date(e.at).getTime() > new Date(cur.at).getTime()) out.set(e.user_id, e)
  }
  return out
}

// Newest first.
export function recentEvents(events: readonly ActivityEvent[], n: number): ActivityEvent[] {
  return [...events].filter(e => e.at).sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, n)
}

export function activityStatus(at: string | null | undefined, now = new Date()): ActivityStatus {
  if (!at) return 'never'
  const age = now.getTime() - new Date(at).getTime()
  if (age < DAY) return 'today'
  if (age < 7 * DAY) return 'week'
  if (age < 30 * DAY) return 'month'
  return 'dormant'
}

export function timeAgo(at: string | null | undefined, now = new Date()): string {
  if (!at) return 'never'
  const t = new Date(at)
  const age = now.getTime() - t.getTime()
  if (age < 60_000) return 'just now'
  if (age < HOUR) return `${Math.floor(age / 60_000)}m ago`
  if (age < DAY) return `${Math.floor(age / HOUR)}h ago`
  if (age < 7 * DAY) return `${Math.floor(age / DAY)}d ago`
  if (age < 30 * DAY) return `${Math.floor(age / (7 * DAY))}w ago`
  return t.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: t.getFullYear() === now.getFullYear() ? undefined : 'numeric' })
}
