import { describe, expect, it } from 'vitest'
import { arrangeTiles, hoursBetween, mealTypeFor, tileOrder } from '@/lib/todayLog'

describe('tileOrder', () => {
  it('leads with sleep in the morning, food at midday, spending in the evening', () => {
    expect(tileOrder(7)[0]).toBe('sleep')
    expect(tileOrder(13)[0]).toBe('meal')
    expect(tileOrder(19)[0]).toBe('spend')
    expect(tileOrder(23)[0]).toBe('mood')
  })
  it('always offers every tile exactly once', () => {
    for (const h of [0, 6, 12, 18, 22]) expect(new Set(tileOrder(h)).size).toBe(7)
  })
})

describe('arrangeTiles', () => {
  it('moves logged tiles to the end, keeping order within each group', () => {
    expect(arrangeTiles(['sleep', 'mood', 'water', 'meal'], new Set(['sleep', 'water'] as const)))
      .toEqual(['mood', 'meal', 'sleep', 'water'])
  })
})

describe('mealTypeFor / hoursBetween', () => {
  it('maps the hour to a meal', () => {
    expect(mealTypeFor(8)).toBe('breakfast')
    expect(mealTypeFor(13)).toBe('lunch')
    expect(mealTypeFor(19)).toBe('dinner')
  })
  it('counts sleep across midnight', () => expect(hoursBetween('23:00', '06:30')).toBe(7.5))
})
