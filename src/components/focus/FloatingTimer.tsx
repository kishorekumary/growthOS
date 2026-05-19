'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Play, Pause, Square } from 'lucide-react'
import { useTimer } from '@/contexts/TimerContext'
import { cn } from '@/lib/utils'

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

  // Hide on the focus page (full UI is shown there) or when no session is running
  if (!runSeq || done || pathname === '/focus') return null

  const step = runSeq.steps[stepIdx]

  return (
    <div className="fixed bottom-[4.75rem] right-4 z-50 sm:bottom-6 sm:right-24">
      <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-[#0d0d1a]/95 backdrop-blur-md shadow-2xl px-4 py-3">
        {/* Tap to return to focus page */}
        <Link href="/focus" className="flex flex-col min-w-0 flex-1 hover:opacity-80 transition-opacity">
          <span className="text-[10px] text-slate-500 truncate max-w-[130px]">
            {runSeq.name}&nbsp;·&nbsp;{step?.label}
          </span>
          <span className={cn(
            'text-xl font-bold tabular-nums leading-none mt-0.5',
            paused ? 'text-slate-400' : 'text-white'
          )}>
            {fmtCountdown(secondsLeft)}
          </span>
          {paused && (
            <span className="text-[10px] text-violet-400 mt-0.5">paused</span>
          )}
        </Link>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={togglePause}
            title={paused ? 'Resume' : 'Pause'}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full border transition-all',
              paused
                ? 'border-violet-400/50 bg-violet-500/20 text-violet-300 hover:bg-violet-500/30'
                : 'border-white/15 bg-white/5 text-white hover:border-violet-400/40 hover:bg-violet-500/10'
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
