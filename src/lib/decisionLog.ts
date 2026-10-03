// Decision log rules — "it's in your moments of decision that your destiny
// is shaped" (Awaken the Giant Within). A real decision comes with an
// immediate first action, then check-ins at 1, 7 and 30 days.

export interface Decision {
  id:           string
  statement:    string
  first_action: string
  decided_on:   string            // YYYY-MM-DD, user's local day
  action_taken: boolean | null
  review_7:     'kept' | 'slipped' | null
  review_30:    'kept' | 'slipped' | null
  created_at:   string
}

export type CheckIn = 'action' | 'review_7' | 'review_30'

export function daysSince(fromDate: string, today: string): number {
  return Math.round(
    (new Date(`${today}T00:00:00Z`).getTime() - new Date(`${fromDate}T00:00:00Z`).getTime()) / 86400000
  )
}

// The one check-in due now, earliest first, or null. Unanswered earlier
// check-ins stay due (they don't expire), so nothing is silently skipped.
export function dueCheckIn(d: Decision, today: string): CheckIn | null {
  const age = daysSince(d.decided_on, today)
  if (age >= 1  && d.action_taken === null) return 'action'
  if (age >= 7  && d.review_7 === null)     return 'review_7'
  if (age >= 30 && d.review_30 === null)    return 'review_30'
  return null
}

export const CHECK_IN_PROMPT: Record<CheckIn, string> = {
  action:    'Did you take your first action?',
  review_7:  'One week in. Are you living this decision?',
  review_30: 'One month in. Is this who you are now?',
}

// Kept = the latest answered review says kept (or, before any review,
// the first action was taken).
export function isKept(d: Decision): boolean | null {
  if (d.review_30) return d.review_30 === 'kept'
  if (d.review_7)  return d.review_7 === 'kept'
  return d.action_taken
}
