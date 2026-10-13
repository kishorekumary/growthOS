import {
  addDays, addMonths, addWeeks, endOfMonth, endOfWeek, format, parseISO, startOfMonth, startOfWeek,
} from 'date-fns'
import type { PeriodType } from './types'

// Planner weeks run Sunday–Saturday. All inputs/outputs are local
// YYYY-MM-DD strings; parseISO on a bare date yields local midnight, so the
// math is calendar-based and DST-safe.
const WEEK = { weekStartsOn: 0 } as const
const fmt = (d: Date) => format(d, 'yyyy-MM-dd')

export function periodStart(type: PeriodType, date: string): string {
  const d = parseISO(date)
  if (type === 'day') return fmt(d)
  if (type === 'week') return fmt(startOfWeek(d, WEEK))
  return fmt(startOfMonth(d))
}

export function periodEnd(type: PeriodType, start: string): string {
  const d = parseISO(start)
  if (type === 'day') return fmt(d)
  if (type === 'week') return fmt(endOfWeek(d, WEEK))
  return fmt(endOfMonth(d))
}

export function shiftPeriod(type: PeriodType, start: string, n: number): string {
  const d = parseISO(start)
  if (type === 'day') return fmt(addDays(d, n))
  if (type === 'week') return fmt(addWeeks(d, n))
  return fmt(addMonths(d, n))
}

export function currentPeriods(today: string): Record<PeriodType, string> {
  return {
    day:   periodStart('day', today),
    week:  periodStart('week', today),
    month: periodStart('month', today),
  }
}

// Earliest date any current period covers — the lower bound for loading
// completions and completed items.
export function windowStart(today: string): string {
  const { week, month } = currentPeriods(today)
  return week < month ? week : month
}

// When the date changes under an open screen (midnight, or a tab left open
// overnight), lists still showing the old current period follow to the new
// one; lists the user navigated elsewhere stay put. Same object back if
// nothing moved, so React can skip the update.
export function rollPeriods(
  starts: Record<PeriodType, string>, prevToday: string, nextToday: string,
): Record<PeriodType, string> {
  if (prevToday === nextToday) return starts
  const prev = currentPeriods(prevToday)
  const next = currentPeriods(nextToday)
  const rolled = { ...starts }
  let changed = false
  for (const type of Object.keys(starts) as PeriodType[]) {
    if (starts[type] === prev[type] && prev[type] !== next[type]) {
      rolled[type] = next[type]
      changed = true
    }
  }
  return changed ? rolled : starts
}

const RELATIVE: Record<PeriodType, [string, string, string]> = {
  day:   ['Yesterday', 'Today', 'Tomorrow'],
  week:  ['Last week', 'This week', 'Next week'],
  month: ['Last month', 'This month', 'Next month'],
}

export function periodLabel(type: PeriodType, start: string, today: string): string {
  const current = periodStart(type, today)
  const offset = [-1, 0, 1].find(n => shiftPeriod(type, current, n) === start)
  if (offset !== undefined) return RELATIVE[type][offset + 1]
  const d = parseISO(start)
  if (type === 'day') return format(d, 'EEE, MMM d')
  if (type === 'week') return `${format(d, 'MMM d')} – ${format(parseISO(periodEnd('week', start)), 'MMM d')}`
  return format(d, 'MMMM yyyy')
}

export interface MoveTarget { label: string; type: PeriodType; start: string }

export function moveTargets(today: string): MoveTarget[] {
  const now = currentPeriods(today)
  return [
    { label: 'Today',      type: 'day',   start: now.day },
    { label: 'Tomorrow',   type: 'day',   start: shiftPeriod('day', now.day, 1) },
    { label: 'This week',  type: 'week',  start: now.week },
    { label: 'Next week',  type: 'week',  start: shiftPeriod('week', now.week, 1) },
    { label: 'This month', type: 'month', start: now.month },
    { label: 'Next month', type: 'month', start: shiftPeriod('month', now.month, 1) },
  ]
}
