import { parseISO } from 'date-fns'
import { periodEnd, periodStart, shiftPeriod } from './periods'
import { isDoneIn } from './visibility'
import { byPriority } from './priority'
import { PERIOD_TYPES, type PeriodType, type PlannerCompletion, type PlannerItem } from './types'

export type ReminderItem = Pick<PlannerItem, 'id' | 'title' | 'period_type' | 'period_start' | 'repeats' | 'is_completed' | 'ended_at'>
  & Partial<Pick<PlannerItem, 'priority'>>

export interface ReminderTitles {
  titles:       string[]  // every open item worth mentioning, high priority first
  highPriority: string[]  // the high-priority subset, for the message to lead with
}

// Titles a reminder on `day` should mention: high-priority items first,
// then day items before week and month ones. Week items are
// only nagged about on Sunday (plan) and Wednesday (midweek); month items in
// the month's last 3 days. Overdue one-offs of an active type are included.
export function reminderTitles(
  items: ReminderItem[],
  completions: Pick<PlannerCompletion, 'item_id' | 'period_start'>[],
  day: string,
): ReminderTitles {
  const dow = parseISO(day).getDay()
  const monthEnd = periodEnd('month', periodStart('month', day))
  const active: Record<PeriodType, boolean> = {
    day:   true,
    week:  dow === 0 || dow === 3,
    month: day >= shiftPeriod('day', monthEnd, -2),
  }
  const open: ReminderItem[] = []
  for (const type of PERIOD_TYPES) {
    if (!active[type]) continue
    const current = periodStart(type, day)
    for (const item of items) {
      if (item.ended_at || item.period_type !== type || item.period_start > current) continue
      const isOpen = item.repeats ? !isDoneIn(item, current, completions) : !item.is_completed
      if (isOpen) open.push(item)
    }
  }
  const sorted = byPriority(open)
  return {
    titles:       sorted.map(i => i.title),
    highPriority: sorted.filter(i => i.priority === 'high').map(i => i.title),
  }
}
