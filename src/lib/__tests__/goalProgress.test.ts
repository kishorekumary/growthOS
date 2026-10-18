import { describe, expect, it } from 'vitest'
import { goalsOverview, timeProgress } from '@/lib/goalProgress'

// Thursday 15 Oct 2026, noon local
const now = new Date(2026, 9, 15, 12)
const iso = (m: number, d: number) => new Date(2026, m - 1, d, 9).toISOString()

describe('timeProgress', () => {
  it('measures the share of the window gone by', () => {
    const p = timeProgress(iso(10, 5), '2026-10-25', now)
    expect(p.elapsed).toBe(0.5)
    expect(p.daysLeft).toBe(10)
    expect(p.urgency).toBe('ok')
  })
  it('flags soon, today and overdue', () => {
    expect(timeProgress(iso(10, 1), '2026-10-20', now).urgency).toBe('soon')
    expect(timeProgress(iso(10, 1), '2026-10-15', now).urgency).toBe('today')
    const late = timeProgress(iso(10, 1), '2026-10-12', now)
    expect(late.urgency).toBe('overdue')
    expect(late.daysLeft).toBe(-3)
    expect(late.elapsed).toBe(1)
  })
  it('has nothing to show without a target date', () => {
    expect(timeProgress(iso(10, 1), null, now)).toEqual({ elapsed: 0, daysLeft: null, urgency: 'none' })
  })
})

describe('goalsOverview', () => {
  const g = (title: string, target: string | null, done = false, completedAt: string | null = null) =>
    ({ title, target_date: target, is_completed: done, completed_at: completedAt })
  const goals = [
    g('Run 10k', '2026-10-17'),           // this week, upcoming
    g('Read 2 books', '2026-10-31'),      // later this month
    g('Fix budget', '2026-10-10'),        // overdue
    g('Learn piano', null),               // undated
    g('Ship app', '2026-09-01', true, iso(9, 1)),
    g('Old win', '2025-06-01', true, new Date(2025, 5, 1).toISOString()),
  ]
  it('counts active, achieved this year, due this week and overdue', () => {
    const o = goalsOverview(goals, now)
    expect(o.active).toBe(4)
    expect(o.achievedThisYear).toBe(1)
    expect(o.dueThisWeek).toBe(1)
    expect(o.overdue).toBe(1)
  })
  it('picks the nearest upcoming deadline, not an overdue one', () => {
    expect(goalsOverview(goals, now).next?.title).toBe('Run 10k')
  })
})
