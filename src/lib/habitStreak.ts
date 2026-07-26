export type Frequency = 'daily' | 'weekly'

export function localDateStr(d: Date = new Date()): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

export function todayStr(): string {
  return localDateStr()
}

export function yesterdayStr(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return localDateStr(d)
}

// Returns the updated streak count for a habit just marked done, evaluated
// as of referenceDate (defaults to now). Pass yesterday's Date to compute a
// grace-period catch-up completion instead of a normal "today" completion.
export function computeStreak(
  current: number,
  lastDoneAt: string | null,
  frequency: Frequency,
  referenceDate: Date = new Date()
): number {
  if (!lastDoneAt) return 1
  const last = new Date(lastDoneAt)
  last.setHours(0, 0, 0, 0)
  const ref = new Date(referenceDate)
  ref.setHours(0, 0, 0, 0)
  const diffDays = Math.round((ref.getTime() - last.getTime()) / 86400000)
  if (frequency === 'daily') {
    if (diffDays === 0) return current
    if (diffDays === 1) return current + 1
    return 1
  }
  if (diffDays === 0) return current
  if (diffDays <= 7) return current + 1
  return 1
}

// Grace deadline for catching up *yesterday's* habit: local noon today.
export function graceDeadlineToday(now: Date = new Date()): Date {
  const d = new Date(now)
  d.setHours(12, 0, 0, 0)
  return d
}

export function isGraceActive(now: Date = new Date()): boolean {
  return now.getTime() < graceDeadlineToday(now).getTime()
}
