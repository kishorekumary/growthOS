import { periodStart } from './periods'
import type { PeriodType, PlannerCompletion, PlannerItem } from './types'

type Placement = Pick<PlannerItem, 'period_type' | 'period_start' | 'repeats' | 'ended_at'>

// Ended items (dropped one-offs, stopped repeats) disappear from every list.
export function isVisibleIn(item: Placement, type: PeriodType, start: string): boolean {
  if (item.ended_at) return false
  if (item.period_type !== type) return false
  return item.repeats ? item.period_start <= start : item.period_start === start
}

export function isDoneIn(
  item: Pick<PlannerItem, 'id' | 'repeats' | 'is_completed'>,
  start: string,
  completions: Pick<PlannerCompletion, 'item_id' | 'period_start'>[],
): boolean {
  if (!item.repeats) return item.is_completed
  return completions.some(c => c.item_id === item.id && c.period_start === start)
}

// Open one-offs whose period is already over. Repeating items never count —
// a missed repeat simply resets.
export function leftovers<T extends Placement & Pick<PlannerItem, 'is_completed'>>(items: T[], today: string): T[] {
  return items.filter(i =>
    !i.repeats && !i.is_completed && !i.ended_at && i.period_start < periodStart(i.period_type, today)
  )
}
