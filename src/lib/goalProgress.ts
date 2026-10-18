import { differenceInCalendarDays, parseISO, startOfDay, startOfWeek, endOfWeek, startOfYear } from 'date-fns'

// Date math for the Goals page: how far along a goal's time window is, and
// the overview numbers. Dates are YYYY-MM-DD target dates and ISO
// timestamps; "today" is the device's local day.

export type Urgency = 'overdue' | 'today' | 'soon' | 'ok' | 'none'

export interface TimeProgress {
  elapsed:  number        // 0–1 share of the created → target window gone by
  daysLeft: number | null // calendar days to the target (negative = overdue)
  urgency:  Urgency
}

export function timeProgress(createdAt: string, targetDate: string | null, now = new Date()): TimeProgress {
  if (!targetDate) return { elapsed: 0, daysLeft: null, urgency: 'none' }
  const start = startOfDay(new Date(createdAt))
  const end   = startOfDay(parseISO(targetDate))
  const today = startOfDay(now)
  const span  = differenceInCalendarDays(end, start)
  const gone  = differenceInCalendarDays(today, start)
  const daysLeft = differenceInCalendarDays(end, today)
  const elapsed = span <= 0 ? 1 : Math.min(1, Math.max(0, gone / span))
  const urgency: Urgency = daysLeft < 0 ? 'overdue' : daysLeft === 0 ? 'today' : daysLeft <= 7 ? 'soon' : 'ok'
  return { elapsed, daysLeft, urgency }
}

export interface GoalLike {
  is_completed: boolean
  completed_at: string | null
  target_date:  string | null
  title:        string
}

export interface GoalsOverview<T extends GoalLike> {
  active:           number
  achievedThisYear: number
  dueThisWeek:      number
  overdue:          number
  next:             T | null   // active goal with the nearest upcoming (or today's) target date
}

export function goalsOverview<T extends GoalLike>(goals: readonly T[], now = new Date()): GoalsOverview<T> {
  const today = startOfDay(now)
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 })
  const weekStart = startOfWeek(now, { weekStartsOn: 1 })
  const yearStart = startOfYear(now)
  const active = goals.filter(g => !g.is_completed)
  const dated = active.filter(g => g.target_date).map(g => ({ g, d: parseISO(g.target_date!) }))
  const upcoming = dated.filter(x => x.d >= today).sort((a, b) => a.d.getTime() - b.d.getTime())
  return {
    active:           active.length,
    achievedThisYear: goals.filter(g => g.is_completed && g.completed_at && new Date(g.completed_at) >= yearStart).length,
    dueThisWeek:      dated.filter(x => x.d >= weekStart && x.d <= weekEnd && x.d >= today).length,
    overdue:          dated.filter(x => x.d < today).length,
    next:             upcoming[0]?.g ?? null,
  }
}
