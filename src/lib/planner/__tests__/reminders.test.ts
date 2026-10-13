import { describe, expect, it } from 'vitest'
import { reminderTitles, type ReminderItem } from '@/lib/planner/reminders'

function r(over: Partial<ReminderItem>): ReminderItem {
  return { id: over.title ?? 'x', title: 'x', period_type: 'day', period_start: '2026-10-13', repeats: false, is_completed: false, ended_at: null, ...over }
}

const items: ReminderItem[] = [
  r({ title: 'today' }),
  r({ title: 'overdue', period_start: '2026-10-10' }),
  r({ title: 'tomorrow', period_start: '2026-10-14' }),
  r({ title: 'done', is_completed: true }),
  r({ title: 'daily-repeat', period_start: '2026-10-01', repeats: true }),
  r({ title: 'week', period_type: 'week', period_start: '2026-10-11' }),
  r({ title: 'month', period_type: 'month', period_start: '2026-10-01' }),
]

describe('reminderTitles', () => {
  it('on a Tuesday mid-month mentions only day items', () => {
    expect(reminderTitles(items, [], '2026-10-13')).toEqual(['today', 'overdue', 'daily-repeat'])
  })
  it('skips a repeating item already done for that day', () => {
    expect(reminderTitles(items, [{ item_id: 'daily-repeat', period_start: '2026-10-13' }], '2026-10-13'))
      .toEqual(['today', 'overdue'])
  })
  it('adds week items on Wednesday and Sunday', () => {
    expect(reminderTitles(items, [], '2026-10-14')).toContain('week')
    expect(reminderTitles([r({ title: 'week', period_type: 'week', period_start: '2026-10-18' })], [], '2026-10-18')).toEqual(['week'])
  })
  it('adds month items only in the last 3 days of the month', () => {
    const feb = [r({ title: 'feb', period_type: 'month', period_start: '2026-02-01' })]
    expect(reminderTitles(feb, [], '2026-02-25')).toEqual([])
    expect(reminderTitles(feb, [], '2026-02-26')).toEqual(['feb'])
    expect(reminderTitles(items, [], '2026-10-29')).toContain('month')
  })
})
