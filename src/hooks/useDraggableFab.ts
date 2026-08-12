'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface Position { x: number; y: number }

const DRAG_THRESHOLD_PX = 6

// Makes a fixed-position floating button draggable via mouse, touch, or pen
// (unified through the Pointer Events API). Position persists per `storageKey`
// in localStorage; until the user first drags, the element keeps its default
// CSS-based corner position.
//
// Drag tracking uses window-level listeners rather than element.setPointerCapture —
// capture on an ancestor of the clickable button can retarget the derived `click`
// event away from the button entirely, silently breaking taps.
export function useDraggableFab(storageKey: string) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<Position | null>(null)
  const draggingRef = useRef(false)
  const movedRef    = useRef(false)
  const startRef    = useRef({ pointerX: 0, pointerY: 0, elemX: 0, elemY: 0 })

  const clamp = useCallback((x: number, y: number) => {
    const el = ref.current
    const w  = el?.offsetWidth  ?? 56
    const h  = el?.offsetHeight ?? 56
    return {
      x: Math.min(Math.max(0, x), window.innerWidth  - w),
      y: Math.min(Math.max(0, y), window.innerHeight - h),
    }
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      // Clamp against the CURRENT viewport — a position persisted on a
      // different-sized window (or before a rotation/resize) can otherwise
      // load off-screen, making the FAB unreachable until the next resize
      // event (the effect below) happens to clamp it back into view.
      if (raw) {
        const parsed = JSON.parse(raw) as Position
        // A malformed stored value (e.g. non-numeric x/y from an older format,
        // or a corrupted write) makes Math.max/min below propagate NaN. React
        // then renders `left`/`top` as invalid CSS, which browsers silently
        // drop — combined with this hook's `right/bottom: 'auto'` override,
        // the element ends up with no valid position: fixed offset at all, so
        // it's placed at its in-flow "static position" instead: pinned at a
        // viewport-relative point far off past the bottom of the layout,
        // invisible and unreachable by scrolling (fixed elements don't move
        // with scroll), and this persists across reloads since it's stored.
        // Treat anything that isn't a finite pair as "no stored position."
        if (Number.isFinite(parsed?.x) && Number.isFinite(parsed?.y)) {
          setPos(clamp(parsed.x, parsed.y))
        } else {
          localStorage.removeItem(storageKey)
        }
      }
    } catch {}
  }, [storageKey, clamp])

  useEffect(() => {
    if (!pos) return
    function onResize() { setPos(p => p ? clamp(p.x, p.y) : p) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [pos, clamp])

  const onWindowPointerMove = useCallback((e: PointerEvent) => {
    if (!draggingRef.current) return
    const dx = e.clientX - startRef.current.pointerX
    const dy = e.clientY - startRef.current.pointerY
    if (Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX) movedRef.current = true
    setPos(clamp(startRef.current.elemX + dx, startRef.current.elemY + dy))
  }, [clamp])

  const onWindowPointerUp = useCallback(() => {
    if (!draggingRef.current) return
    draggingRef.current = false
    window.removeEventListener('pointermove', onWindowPointerMove)
    window.removeEventListener('pointerup', onWindowPointerUp)
    setPos(p => {
      if (p) { try { localStorage.setItem(storageKey, JSON.stringify(p)) } catch {} }
      return p
    })
  }, [onWindowPointerMove, storageKey])

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    draggingRef.current = true
    movedRef.current    = false
    startRef.current = { pointerX: e.clientX, pointerY: e.clientY, elemX: rect.left, elemY: rect.top }
    window.addEventListener('pointermove', onWindowPointerMove)
    window.addEventListener('pointerup', onWindowPointerUp)
  }

  const style: React.CSSProperties = pos
    ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto', touchAction: 'none' }
    : { touchAction: 'none' }

  return {
    ref,
    style,
    // Read by the button's own onClick to skip opening the modal right after a drag.
    // Naturally resets on the next pointerdown, so no explicit "consume" step is needed.
    wasDragged: () => movedRef.current,
    handlers: { onPointerDown },
  }
}
