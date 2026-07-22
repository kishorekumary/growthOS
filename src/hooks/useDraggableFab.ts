'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface Position { x: number; y: number }

const DRAG_THRESHOLD_PX = 5

// Makes a fixed-position floating button draggable via mouse, touch, or pen
// (unified through the Pointer Events API). Position persists per `storageKey`
// in localStorage; until the user first drags, the element keeps its default
// CSS-based corner position.
export function useDraggableFab(storageKey: string) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<Position | null>(null)
  const draggingRef = useRef(false)
  const movedRef    = useRef(false)
  const startRef    = useRef({ pointerX: 0, pointerY: 0, elemX: 0, elemY: 0 })

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) setPos(JSON.parse(raw))
    } catch {}
  }, [storageKey])

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
    if (!pos) return
    function onResize() { setPos(p => p ? clamp(p.x, p.y) : p) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [pos, clamp])

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const el = ref.current
    if (!el) return
    el.setPointerCapture(e.pointerId)
    const rect = el.getBoundingClientRect()
    draggingRef.current = true
    movedRef.current    = false
    startRef.current = { pointerX: e.clientX, pointerY: e.clientY, elemX: rect.left, elemY: rect.top }
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return
    const dx = e.clientX - startRef.current.pointerX
    const dy = e.clientY - startRef.current.pointerY
    if (Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX) movedRef.current = true
    setPos(clamp(startRef.current.elemX + dx, startRef.current.elemY + dy))
  }

  function endDrag() {
    if (!draggingRef.current) return
    draggingRef.current = false
    setPos(p => {
      if (p) { try { localStorage.setItem(storageKey, JSON.stringify(p)) } catch {} }
      return p
    })
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    ref.current?.releasePointerCapture(e.pointerId)
    endDrag()
  }

  // Swallow the click that follows a drag so the FAB doesn't also pop open
  // its modal right after being dropped.
  function onClickCapture(e: React.MouseEvent<HTMLDivElement>) {
    if (movedRef.current) {
      e.preventDefault()
      e.stopPropagation()
      movedRef.current = false
    }
  }

  const style: React.CSSProperties = pos
    ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto', touchAction: 'none' }
    : { touchAction: 'none' }

  return {
    ref,
    style,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onClickCapture },
  }
}
