// Drag-to-page gesture maths (Quick Log). The page follows the finger;
// on release it either completes the move or springs back.

export const SWIPE = {
  slop:      8,     // px of movement before deciding the gesture's axis
  ratio:     1.2,   // sideways must beat vertical by this much to page
  distance:  0.25,  // release past this share of the width → change page
  flickPx:   30,    // …or a quick flick of at least this far
  flickVel:  0.45,  // …at this many px per ms
  rubber:    0.25,  // dragging past the first / last page moves this much
} as const

// Which way a drag is going once it's moved enough to tell; null = not yet.
export function gestureAxis(dx: number, dy: number): 'x' | 'y' | null {
  if (Math.abs(dx) < SWIPE.slop && Math.abs(dy) < SWIPE.slop) return null
  return Math.abs(dx) > Math.abs(dy) * SWIPE.ratio ? 'x' : 'y'
}

// Should releasing this drag change page? dx px, dt ms, width px.
export function swipeCommits(dx: number, dt: number, width: number): boolean {
  const d = Math.abs(dx)
  if (d >= width * SWIPE.distance) return true
  return d >= SWIPE.flickPx && dt > 0 && d / dt >= SWIPE.flickVel
}

// How far the page visibly moves: with the finger, or resisting at the ends.
export function dragOffset(dx: number, canMove: boolean): number {
  return canMove ? dx : dx * SWIPE.rubber
}
