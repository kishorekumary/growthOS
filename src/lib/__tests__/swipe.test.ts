import { describe, expect, it } from 'vitest'
import { dragOffset, gestureAxis, swipeCommits } from '@/lib/swipe'

describe('gestureAxis', () => {
  it('waits until the finger has moved a little', () => expect(gestureAxis(4, 3)).toBeNull())
  it('pages on clearly sideways drags, scrolls on vertical ones', () => {
    expect(gestureAxis(-30, 5)).toBe('x')
    expect(gestureAxis(10, 30)).toBe('y')
    expect(gestureAxis(20, 19)).toBe('y')
  })
})

describe('swipeCommits', () => {
  it('commits past a quarter of the width', () => {
    expect(swipeCommits(-100, 900, 360)).toBe(true)
    expect(swipeCommits(-80, 900, 360)).toBe(false)
  })
  it('commits on a quick flick even if short', () => {
    expect(swipeCommits(50, 80, 360)).toBe(true)
    expect(swipeCommits(20, 20, 360)).toBe(false)
  })
})

describe('dragOffset', () => {
  it('follows the finger, or resists at the first / last page', () => {
    expect(dragOffset(-100, true)).toBe(-100)
    expect(dragOffset(-100, false)).toBe(-25)
  })
})
