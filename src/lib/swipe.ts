// Horizontal swipe detection for paging (Quick Log). A swipe counts when
// it travels far enough, mostly sideways, and quickly — so vertical
// scrolling and slow drags (e.g. selecting text) don't page.

export type SwipeDir = 'next' | 'prev'

export const SWIPE = { minDx: 60, ratio: 1.5, maxMs: 700 } as const

// dx/dy: finger movement in px (end − start); dt: duration in ms.
// Finger moving left (dx < 0) goes to the next page.
export function swipeIntent(dx: number, dy: number, dt: number): SwipeDir | null {
  if (dt > SWIPE.maxMs) return null
  if (Math.abs(dx) < SWIPE.minDx) return null
  if (Math.abs(dx) < Math.abs(dy) * SWIPE.ratio) return null
  return dx < 0 ? 'next' : 'prev'
}
