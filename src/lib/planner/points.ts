import { periodEnd } from './periods'
import type { PeriodType, PlannerItem } from './types'

export const BASE_POINTS: Record<PeriodType, number> = { day: 10, week: 20, month: 40 }
export const ON_TIME_BONUS = 5

// completedOn is the device-local YYYY-MM-DD the user checked the item.
// A one-off earns the bonus if finished on or before its period's last day;
// leftovers completed from the review sheet are past it, so get base only.
export function pointsFor(
  item: Pick<PlannerItem, 'period_type' | 'period_start' | 'repeats'>,
  completedOn: string,
): number {
  const base = BASE_POINTS[item.period_type]
  if (item.repeats) return base
  return completedOn <= periodEnd(item.period_type, item.period_start) ? base + ON_TIME_BONUS : base
}
