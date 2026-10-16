import { useEffect, useRef, useState } from 'react'
import type { Pt } from '@/lib/mindmapLayout'
import { osReducedMotion } from '@/lib/effects'

const ease = (t: number) => 1 - Math.pow(1 - t, 3)

// Glides positions from wherever they are on screen to `target` whenever it
// changes, so the mind map's nodes and edges move together (both render from
// the returned map). Ids new to `target` appear in place — their own
// entrance animation handles the reveal. `from` seeds the starting point
// when nothing has been shown yet (e.g. switching from the free layout).
export function useTweenedPositions(
  target: Map<string, Pt> | null,
  from: () => Map<string, Pt>,
  ms = 420,
): Map<string, Pt> | null {
  const [shown, setShown] = useState(target)
  const shownRef = useRef<Map<string, Pt> | null>(target)
  const fromRef = useRef(from)
  fromRef.current = from

  useEffect(() => {
    if (!target) { shownRef.current = null; setShown(null); return }
    const start = shownRef.current ?? fromRef.current()
    if (osReducedMotion()) { shownRef.current = target; setShown(target); return }

    let frame = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = ease(Math.min((now - t0) / ms, 1))
      const next = new Map<string, Pt>()
      target.forEach((to, id) => {
        const a = start.get(id)
        next.set(id, a && p < 1 ? { x: a.x + (to.x - a.x) * p, y: a.y + (to.y - a.y) * p } : to)
      })
      shownRef.current = next
      setShown(next)
      if (p < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, ms])

  return shown
}
