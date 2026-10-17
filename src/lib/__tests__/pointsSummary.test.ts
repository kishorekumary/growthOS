import { describe, expect, it } from 'vitest'
import { daysToAfford, isSpend, summarizePoints, type PointsLogRow } from '@/lib/pointsSummary'

// Thursday 15 Oct 2026, 18:00 local (tests run with TZ=America/New_York)
const now = new Date(2026, 9, 15, 18, 0)
const at = (day: number, hour = 12) => new Date(2026, 9, day, hour).toISOString()
const row = (delta: number, reason: string, day: number, hour?: number): PointsLogRow =>
  ({ delta, reason, created_at: at(day, hour) })

describe('isSpend', () => {
  it('counts redemptions and shop purchases, not planner un-checks', () => {
    expect(isSpend({ delta: -300, reason: 'Redeemed: Lunch out' })).toBe(true)
    expect(isSpend({ delta: -50, reason: 'Bought: streak freeze' })).toBe(true)
    expect(isSpend({ delta: -5, reason: 'Planner: Call mum' })).toBe(false)
    expect(isSpend({ delta: 10, reason: 'Redeemed: refund' })).toBe(false)
  })
})

describe('summarizePoints', () => {
  const rows = [
    row(10, 'Daily: Meditate', 15, 7),
    row(5, 'Daily: Read', 15, 0),          // just after midnight → today
    row(-300, 'Redeemed: Lunch out', 15),  // spending → ignored
    row(-5, 'Planner: un-check', 15),      // takes back earning
    row(20, 'Daily chest (day 3)', 13),    // Tuesday → this week
    row(40, 'Milestone: Read 7-day', 11),  // Sunday → last week, within 7 days
    row(99, 'Daily: Old', 8),              // outside the 7-day window
  ]

  it('splits today and this week (weeks start Monday)', () => {
    const s = summarizePoints(rows, 1000, 0, now)
    expect(s.today).toBe(10)
    expect(s.week).toBe(30)
  })

  it('all-time earned is balance plus everything spent', () => {
    expect(summarizePoints([], 1240, 800, now).earnedAllTime).toBe(2040)
  })

  it('daily pace averages the last 7 days of earning', () => {
    expect(summarizePoints(rows, 0, 0, now).dailyPace).toBe((10 + 5 - 5 + 20 + 40) / 7)
  })

  it('never reports a negative pace', () => {
    expect(summarizePoints([row(-20, 'Planner: un-check', 15)], 0, 0, now).dailyPace).toBe(0)
  })
})

describe('daysToAfford', () => {
  it('is 0 when already affordable', () => expect(daysToAfford(300, 300, 0)).toBe(0))
  it('rounds up the days needed', () => expect(daysToAfford(500, 240, 40)).toBe(7))
  it('is null with no recent earning', () => expect(daysToAfford(500, 240, 0)).toBeNull())
})
