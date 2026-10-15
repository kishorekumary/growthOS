'use client'

import { useEffect, useRef, useState } from 'react'
import { osReducedMotion } from '@/lib/effects'

const DURATION = 700

// A number that counts from its previous value to the new one (from 0 on
// first mount). The first render shows the real value, so server HTML and
// slow devices never show a wrong number; under "reduce motion" it never
// animates.
export default function CountUp({ value, className }: { value: number; className?: string }) {
  const [shown, setShown] = useState(value)
  // What is on screen right now (0 before mount), so an interrupted count
  // continues from where it got to.
  const current = useRef(0)

  useEffect(() => {
    const start = current.current
    if (start === value || osReducedMotion()) { current.current = value; setShown(value); return }

    let frame = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - t0) / DURATION, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      current.current = Math.round(start + (value - start) * eased)
      setShown(current.current)
      if (p < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value])

  return <span className={className ?? 'tabular-nums'}>{shown}</span>
}
