import { describe, expect, it } from 'vitest'
import { isDoneIn, isVisibleIn, leftovers } from '@/lib/planner/visibility'
import type { PlannerItem } from '@/lib/planner/types'

function item(over: Partial<PlannerItem>): PlannerItem {
  return {
    id: 'i1', user_id: 'u1', title: 'x', notes: null, period_type: 'week', period_start: '2026-10-11',
    repeats: false, is_completed: false, completed_at: null, points_awarded: 0, carry_count: 0,
    ended_at: null, sort_order: 0, priority: null, created_at: '2026-10-11T00:00:00Z', ...over,
  }
}

describe('isVisibleIn', () => {
  it('shows a one-off only in its own period', () => {
    const i = item({})
    expect(isVisibleIn(i, 'week', '2026-10-11')).toBe(true)
    expect(isVisibleIn(i, 'week', '2026-10-18')).toBe(false)
    expect(isVisibleIn(i, 'day', '2026-10-11')).toBe(false)
  })
  it('shows a repeating item from its start onward, never before', () => {
    const i = item({ repeats: true })
    expect(isVisibleIn(i, 'week', '2026-10-04')).toBe(false)
    expect(isVisibleIn(i, 'week', '2026-10-11')).toBe(true)
    expect(isVisibleIn(i, 'week', '2027-03-07')).toBe(true)
  })
  it('hides ended items everywhere', () => {
    expect(isVisibleIn(item({ ended_at: '2026-10-12T00:00:00Z' }), 'week', '2026-10-11')).toBe(false)
    expect(isVisibleIn(item({ repeats: true, ended_at: '2026-10-12T00:00:00Z' }), 'week', '2026-10-04')).toBe(false)
  })
})

describe('isDoneIn', () => {
  it('uses is_completed for one-offs', () => {
    expect(isDoneIn(item({ is_completed: true }), '2026-10-11', [])).toBe(true)
  })
  it('uses the completion for that period for repeating items', () => {
    const i = item({ repeats: true })
    const done = [{ item_id: 'i1', period_start: '2026-10-11' }]
    expect(isDoneIn(i, '2026-10-11', done)).toBe(true)
    expect(isDoneIn(i, '2026-10-18', done)).toBe(false)
  })
})

describe('leftovers', () => {
  const today = '2026-10-13'
  it('returns open one-offs from past periods only', () => {
    const items = [
      item({ id: 'past-day',   period_type: 'day',   period_start: '2026-10-12' }),
      item({ id: 'today',      period_type: 'day',   period_start: '2026-10-13' }),
      item({ id: 'past-week',  period_type: 'week',  period_start: '2026-10-04' }),
      item({ id: 'this-week',  period_type: 'week',  period_start: '2026-10-11' }),
      item({ id: 'past-month', period_type: 'month', period_start: '2026-09-01' }),
      item({ id: 'done',       period_type: 'day',   period_start: '2026-10-01', is_completed: true }),
      item({ id: 'dropped',    period_type: 'day',   period_start: '2026-10-01', ended_at: '2026-10-02T00:00:00Z' }),
      item({ id: 'repeating',  period_type: 'day',   period_start: '2026-10-01', repeats: true }),
    ]
    expect(leftovers(items, today).map(i => i.id)).toEqual(['past-day', 'past-week', 'past-month'])
  })
})
