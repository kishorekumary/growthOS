'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Play, Pause, Square, GripVertical } from 'lucide-react'
import { useTimer } from '@/contexts/TimerContext'
import { cn } from '@/lib/utils'
import { useState, useRef, useEffect, useCallback } from 'react'

function fmtCountdown(secs: number) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

export default function FloatingTimer() {
  const { runSeq, stepIdx, secondsLeft, paused, done, togglePause, stopTimer } = useTimer()
  const pathname = usePathname()

  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const widgetRef = useRef<HTMLDivElement>(null)
  const dragRef   = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)

  // Set initial top-right position after mount (window not available on server)
  useEffect(() => {
    setPos(p => p ?? { x: window.innerWidth - 268, y: 16 })
  }, [])

  // Re-clamp when the window is resized so it never goes off-screen
  useEffect(() => {
    function clamp() {
      if (!widgetRef.current) return
      setPos(p => p ? {
        x: Math.max(0, Math.min(window.innerWidth  - widgetRef.current!.offsetWidth,  p.x)),
        y: Math.max(0, Math.min(window.innerHeight - widgetRef.current!.offsetHeight, p.y)),
      } : p)
    }
    window.addEventListener('resize', clamp)
    return () => window.removeEventListener('resize', clamp)
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos?.x ?? 0, origY: pos?.y ?? 0 }
    e.preventDefault()
  }, [pos])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || !widgetRef.current) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    setPos({
      x: Math.max(0, Math.min(window.innerWidth  - widgetRef.current.offsetWidth,  dragRef.current.origX + dx)),
      y: Math.max(0, Math.min(window.innerHeight - widgetRef.current.offsetHeight, dragRef.current.origY + dy)),
    })
  }, [])

  const onPointerUp = useCallback(() => { dragRef.current = null }, [])

  if (!runSeq || done || pathname === '/focus' || !pos) return null

  const step = runSeq.steps[stepIdx]

  return (
    <div
      ref={widgetRef}
      style={{ left: pos.x, top: pos.y, position: 'fixed', zIndex: 50 }}
    >
      <div className="flex items-center rounded-2xl border border-white/15 bg-[#0d0d1a]/95 backdrop-blur-md shadow-2xl">

        {/* Drag handle */}
        <div
          className="flex items-center self-stretch px-2 cursor-grab active:cursor-grabbing text-slate-700 hover:text-slate-500 hover:bg-white/5 rounded-l-2xl transition-colors touch-none select-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <GripVertical className="h-4 w-4" />
        </div>

        {/* Timer info — tap to return to focus page */}
        <Link
          href="/focus"
          className="flex flex-col py-2.5 pr-1 min-w-0 flex-1 hover:opacity-80 transition-opacity"
        >
          <span className="text-[10px] text-slate-500 truncate max-w-[118px]">
            {runSeq.name}&nbsp;·&nbsp;{step?.label}
          </span>
          <span className={cn(
            'text-xl font-bold tabular-nums leading-none mt-0.5',
            paused ? 'text-slate-400' : 'text-white',
          )}>
            {fmtCountdown(secondsLeft)}
          </span>
          {paused && <span className="text-[10px] text-violet-400 mt-0.5">paused</span>}
        </Link>

        {/* Controls */}
        <div className="flex items-center gap-1.5 px-3 shrink-0">
          <button
            onClick={togglePause}
            title={paused ? 'Resume' : 'Pause'}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full border transition-all',
              paused
                ? 'border-violet-400/50 bg-violet-500/20 text-violet-300 hover:bg-violet-500/30'
                : 'border-white/15 bg-white/5 text-white hover:border-violet-400/40 hover:bg-violet-500/10',
            )}
          >
            {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={stopTimer}
            title="End session"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
          >
            <Square className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
