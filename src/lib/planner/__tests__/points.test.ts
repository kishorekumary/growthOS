import { describe, expect, it } from 'vitest'
import { pointsFor } from '@/lib/planner/points'

describe('pointsFor', () => {
  it('scales by period and adds the on-time bonus', () => {
    expect(pointsFor({ period_type: 'day',   period_start: '2026-10-13', repeats: false }, '2026-10-13')).toBe(15)
    expect(pointsFor({ period_type: 'week',  period_start: '2026-10-11', repeats: false }, '2026-10-17')).toBe(25)
    expect(pointsFor({ period_type: 'month', period_start: '2026-10-01', repeats: false }, '2026-10-31')).toBe(45)
  })
  it('gives the bonus when finished early', () => {
    expect(pointsFor({ period_type: 'week', period_start: '2026-10-18', repeats: false }, '2026-10-13')).toBe(25)
  })
  it('gives no bonus after the period ended (e.g. Done from review)', () => {
    expect(pointsFor({ period_type: 'day',  period_start: '2026-10-12', repeats: false }, '2026-10-13')).toBe(10)
    expect(pointsFor({ period_type: 'week', period_start: '2026-10-04', repeats: false }, '2026-10-11')).toBe(20)
  })
  it('gives base points only for repeating items', () => {
    expect(pointsFor({ period_type: 'day',   period_start: '2026-10-01', repeats: true }, '2026-10-13')).toBe(10)
    expect(pointsFor({ period_type: 'month', period_start: '2026-10-01', repeats: true }, '2026-10-13')).toBe(40)
  })
})
