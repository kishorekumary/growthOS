import { describe, expect, it } from 'vitest'
import { DAYPART_INIT_SCRIPT, daypartOf } from '@/lib/daypart'

describe('daypartOf', () => {
  it('splits the day at 5, 12, 17 and 21', () => {
    expect(daypartOf(4)).toBe('night')
    expect(daypartOf(5)).toBe('morning')
    expect(daypartOf(11)).toBe('morning')
    expect(daypartOf(12)).toBe('afternoon')
    expect(daypartOf(16)).toBe('afternoon')
    expect(daypartOf(17)).toBe('evening')
    expect(daypartOf(20)).toBe('evening')
    expect(daypartOf(21)).toBe('night')
    expect(daypartOf(0)).toBe('night')
  })

  it('matches the inlined pre-paint script for every hour', () => {
    for (let h = 0; h < 24; h++) {
      const el = { dataset: {} as Record<string, string> }
      const fakeDate = function () { return { getHours: () => h } }
      new Function('document', 'Date', DAYPART_INIT_SCRIPT)({ documentElement: el }, fakeDate)
      expect(el.dataset.daypart).toBe(daypartOf(h))
    }
  })
})
