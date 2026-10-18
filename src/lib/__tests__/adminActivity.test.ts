import { describe, expect, it } from 'vitest'
import { activityStatus, latestByUser, recentEvents, timeAgo } from '@/lib/admin/activity'

const now = new Date('2026-10-18T12:00:00Z')
const h = (n: number) => new Date(now.getTime() - n * 3_600_000).toISOString()

describe('latestByUser', () => {
  it('keeps each user’s newest event with its label', () => {
    const m = latestByUser([
      { user_id: 'a', at: h(30), label: 'Signed in' },
      { user_id: 'a', at: h(2), label: 'Logged a meal' },
      { user_id: 'b', at: h(200), label: 'Daily: Read' },
    ])
    expect(m.get('a')?.label).toBe('Logged a meal')
    expect(m.get('b')?.label).toBe('Daily: Read')
  })
})

describe('recentEvents', () => {
  it('sorts newest first and limits', () => {
    const e = recentEvents([
      { user_id: 'a', at: h(5), label: 'x' }, { user_id: 'a', at: h(1), label: 'y' }, { user_id: 'a', at: h(9), label: 'z' },
    ], 2)
    expect(e.map(x => x.label)).toEqual(['y', 'x'])
  })
})

describe('activityStatus / timeAgo', () => {
  it('buckets by age', () => {
    expect(activityStatus(h(3), now)).toBe('today')
    expect(activityStatus(h(50), now)).toBe('week')
    expect(activityStatus(h(24 * 10), now)).toBe('month')
    expect(activityStatus(h(24 * 40), now)).toBe('dormant')
    expect(activityStatus(null, now)).toBe('never')
  })
  it('reads naturally', () => {
    expect(timeAgo(h(0), now)).toBe('just now')
    expect(timeAgo(h(0.5), now)).toBe('30m ago')
    expect(timeAgo(h(5), now)).toBe('5h ago')
    expect(timeAgo(h(50), now)).toBe('2d ago')
    expect(timeAgo(h(24 * 15), now)).toBe('2w ago')
    expect(timeAgo(null, now)).toBe('never')
  })
})
