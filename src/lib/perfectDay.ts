export interface DailyHabitLike { id: string; frequency: 'daily' | 'weekly' }
export interface HabitLogLike   { habit_id: string; status: 'done' | 'missed' }

// A day counts as "perfect" if every *daily*-frequency habit (weekly
// habits excluded — they don't need daily action) has a log for that
// day, whether 'done' or 'missed' (skipped). Only a habit left with NO
// log at all — i.e. still pending, actionable — blocks "perfect". This
// matches HabitTracker.tsx's own convention of excluding missed habits
// from its "X/Y done today" tally. Pass whichever day's habits/logs you
// want evaluated — the caller decides "today" vs "yesterday".
//
// A user with zero daily habits can never have a "perfect day" — there's
// nothing to be perfect about.
export function isPerfectDay(habits: DailyHabitLike[], logsForDay: HabitLogLike[]): boolean {
  const dailyHabits = habits.filter(h => h.frequency === 'daily')
  if (dailyHabits.length === 0) return false
  const loggedIds = new Set(logsForDay.map(l => l.habit_id))
  return dailyHabits.every(h => loggedIds.has(h.id))
}
