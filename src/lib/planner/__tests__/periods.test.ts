import { describe, expect, it } from 'vitest'
import {
  currentPeriods, moveTargets, periodEnd, periodLabel, periodStart, rollPeriods, shiftPeriod, windowStart,
} from '@/lib/planner/periods'

describe('periodStart', () => {
  it('uses Sunday as the start of the week', () => {
    expect(periodStart('week', '2026-10-13')).toBe('2026-10-11') // Tue → Sun
    expect(periodStart('week', '2026-10-11')).toBe('2026-10-11') // Sun → itself
    expect(periodStart('week', '2026-10-17')).toBe('2026-10-11') // Sat → previous Sun
  })
  it('crosses the year boundary', () => {
    expect(periodStart('week', '2027-01-01')).toBe('2026-12-27')
  })
  it('returns the 1st for months and the day itself for days', () => {
    expect(periodStart('month', '2026-10-13')).toBe('2026-10-01')
    expect(periodStart('day', '2026-10-13')).toBe('2026-10-13')
  })
})

describe('periodEnd', () => {
  it('handles short and leap Februaries', () => {
    expect(periodEnd('month', '2026-02-01')).toBe('2026-02-28')
    expect(periodEnd('month', '2028-02-01')).toBe('2028-02-29')
  })
  it('ends weeks on Saturday', () => {
    expect(periodEnd('week', '2026-10-11')).toBe('2026-10-17')
  })
})

describe('shiftPeriod', () => {
  it('steps calendar days across a DST change', () => {
    expect(shiftPeriod('day', '2026-10-31', 1)).toBe('2026-11-01')
    expect(shiftPeriod('day', '2026-11-01', 1)).toBe('2026-11-02')
  })
  it('steps weeks and months', () => {
    expect(shiftPeriod('week', '2026-10-25', 1)).toBe('2026-11-01')
    expect(shiftPeriod('month', '2026-12-01', 1)).toBe('2027-01-01')
    expect(shiftPeriod('month', '2026-10-01', -1)).toBe('2026-09-01')
  })
})

describe('currentPeriods / windowStart', () => {
  it('returns all three current starts', () => {
    expect(currentPeriods('2026-10-13')).toEqual({ day: '2026-10-13', week: '2026-10-11', month: '2026-10-01' })
  })
  it('picks the earlier of week start and month start', () => {
    expect(windowStart('2026-10-13')).toBe('2026-10-01')
    expect(windowStart('2026-10-01')).toBe('2026-09-27')
  })
})

describe('periodLabel', () => {
  const today = '2026-10-13'
  it('uses relative names near today', () => {
    expect(periodLabel('day', '2026-10-13', today)).toBe('Today')
    expect(periodLabel('day', '2026-10-14', today)).toBe('Tomorrow')
    expect(periodLabel('day', '2026-10-12', today)).toBe('Yesterday')
    expect(periodLabel('week', '2026-10-11', today)).toBe('This week')
    expect(periodLabel('week', '2026-10-18', today)).toBe('Next week')
    expect(periodLabel('month', '2026-09-01', today)).toBe('Last month')
  })
  it('falls back to dates further away', () => {
    expect(periodLabel('day', '2026-10-20', today)).toBe('Tue, Oct 20')
    expect(periodLabel('week', '2026-11-01', today)).toBe('Nov 1 – Nov 7')
    expect(periodLabel('month', '2026-12-01', today)).toBe('December 2026')
  })
})

describe('moveTargets', () => {
  it('lists the six quick destinations', () => {
    expect(moveTargets('2026-10-13')).toEqual([
      { label: 'Today',      type: 'day',   start: '2026-10-13' },
      { label: 'Tomorrow',   type: 'day',   start: '2026-10-14' },
      { label: 'This week',  type: 'week',  start: '2026-10-11' },
      { label: 'Next week',  type: 'week',  start: '2026-10-18' },
      { label: 'This month', type: 'month', start: '2026-10-01' },
      { label: 'Next month', type: 'month', start: '2026-11-01' },
    ])
  })
})

describe('rollPeriods', () => {
  it('moves lists that were on the old current period to the new one', () => {
    const starts = currentPeriods('2026-10-31') // Sat: week of Oct 25, October
    expect(rollPeriods(starts, '2026-10-31', '2026-11-01')).toEqual({
      day: '2026-11-01', week: '2026-11-01', month: '2026-11-01',
    })
  })
  it('only moves the lists whose period actually changed', () => {
    const starts = currentPeriods('2026-10-13')
    expect(rollPeriods(starts, '2026-10-13', '2026-10-14')).toEqual({
      day: '2026-10-14', week: '2026-10-11', month: '2026-10-01',
    })
  })
  it('keeps lists the user navigated away from', () => {
    const starts = { day: '2026-10-20', week: '2026-10-04', month: '2026-12-01' }
    expect(rollPeriods(starts, '2026-10-17', '2026-10-18')).toEqual(starts)
  })
  it('returns the same object when the day did not change', () => {
    const starts = currentPeriods('2026-10-13')
    expect(rollPeriods(starts, '2026-10-13', '2026-10-13')).toBe(starts)
  })
})
