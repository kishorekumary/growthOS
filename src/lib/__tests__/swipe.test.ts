import { describe, expect, it } from 'vitest'
import { swipeIntent } from '@/lib/swipe'

describe('swipeIntent', () => {
  it('finger left → next page, right → previous', () => {
    expect(swipeIntent(-120, 10, 250)).toBe('next')
    expect(swipeIntent(120, -10, 250)).toBe('prev')
  })
  it('ignores short, mostly vertical or slow movements', () => {
    expect(swipeIntent(-40, 0, 200)).toBeNull()
    expect(swipeIntent(-90, 80, 200)).toBeNull()
    expect(swipeIntent(-150, 0, 1200)).toBeNull()
  })
})
