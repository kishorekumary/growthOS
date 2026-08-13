export interface DailyHabitLike { id: string; frequency: 'daily' | 'weekly' }
export interface HabitLogLike   { habit_id: string; status: 'done' | 'missed' | 'auto_missed' }

// A day counts as "perfect" if every *daily*-frequency habit (weekly
// habits excluded — they don't need daily action) has a log for that
// day, whether 'done' or 'missed' (skipped). Only a habit left with NO
// log at all — i.e. still pending, actionable — blocks "perfect". This
// matches HabitTracker.tsx's own convention of excluding missed habits
// from its "X/Y done today" tally. Pass whichever day's habits/logs you
// want evaluated — the caller decides "today" vs "yesterday".
//
// 'auto_missed' logs (the nightly cron's silent backfill for a habit the
// user never touched) do NOT count as "handled" here — they behave
// exactly like no log at all, i.e. still pending/blocking. Only a real
// user action ('done' or a user-initiated 'missed'/skip) satisfies a
// habit for perfect-day purposes. Without this distinction, a
// mostly-untouched day would retroactively look "perfect" the moment the
// cron ran and silently backfilled every untouched habit as handled.
//
// A user with zero daily habits can never have a "perfect day" — there's
// nothing to be perfect about.
export function isPerfectDay(habits: DailyHabitLike[], logsForDay: HabitLogLike[]): boolean {
  const dailyHabits = habits.filter(h => h.frequency === 'daily')
  if (dailyHabits.length === 0) return false
  const handledIds = new Set(
    logsForDay.filter(l => l.status !== 'auto_missed').map(l => l.habit_id)
  )
  return dailyHabits.every(h => handledIds.has(h.id))
}
