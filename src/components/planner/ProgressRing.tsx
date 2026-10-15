'use client'

import { useEffect, useState } from 'react'

export default function ProgressRing({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0
  // Start from 0 and set the real value after mount, so the ring sweeps in
  // on first view as well as on every change (.progress-ring transitions).
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(pct))
    return () => cancelAnimationFrame(id)
  }, [pct])

  return (
    <div
      className="progress-ring flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
      style={{ '--ring-pct': shown } as React.CSSProperties}
      aria-label={`${done} of ${total} done`}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-950 text-xs font-bold text-white">
        {pct}%
      </span>
    </div>
  )
}
