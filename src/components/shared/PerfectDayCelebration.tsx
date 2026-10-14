'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { PERFECT_DAY_EVENT, type PerfectDay } from '@/lib/completeHabit'
import { todayStr } from '@/lib/habitStreak'
import { feedbackAllowed, haptic, motionAllowed } from '@/lib/effects'

// Full-screen celebration when the last daily habit of the day gets checked
// off. Triggered by PERFECT_DAY_EVENT (src/lib/completeHabit.ts), so it
// plays from any screen. Confetti rains across the whole viewport behind a
// trophy card; tap anywhere to close, otherwise it fades out on its own.
// Respects the Celebrations setting (src/lib/effects.ts): with motion off,
// just the card.

const DURATION_MS = 4200
const COLORS = ['#22c55e', '#a78bfa', '#fbbf24', '#38bdf8', '#f472b6', '#fb923c']
const PIECE_COUNT = 90

interface Piece { id: number; left: number; drift: number; rotate: number; delay: number; duration: number; color: string; shape: string }

function randomPieces(): Piece[] {
  return Array.from({ length: PIECE_COUNT }, (_, id) => ({
    id,
    left: Math.random() * 100,                          // vw
    drift: Math.round((Math.random() - 0.5) * 160),     // px
    rotate: Math.round(Math.random() * 1080 - 540),     // deg
    delay: Math.round(Math.random() * 1400) / 1000,     // 0 .. 1.4s
    duration: 2.2 + Math.random() * 1.4,                // 2.2 .. 3.6s
    color: COLORS[id % COLORS.length],
    shape: id % 3 === 0 ? 'h-2.5 w-2.5 rounded-full' : id % 3 === 1 ? 'h-3 w-1.5 rounded-sm' : 'h-1.5 w-3.5 rounded-sm',
  }))
}

interface PieceStyle extends CSSProperties { '--pd-drift': string; '--pd-rotate': string }

// Rising four-note fanfare (C-E-G-C) with the Web Audio API, in the same
// spirit as the per-habit chime in useHabitCelebration.
function playFanfare() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    const AudioCtx = w.AudioContext ?? w.webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const now = ctx.currentTime

    const note = (freq: number, start: number, dur: number) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(freq, now + start)
      gain.gain.setValueAtTime(0, now + start)
      gain.gain.linearRampToValueAtTime(0.2, now + start + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + start)
      osc.stop(now + start + dur)
    }

    note(523.25, 0,    0.18) // C5
    note(659.25, 0.12, 0.18) // E5
    note(783.99, 0.24, 0.18) // G5
    note(1046.5, 0.36, 0.6)  // C6

    setTimeout(() => ctx.close(), 1200)
  } catch {
    // Audio unavailable/blocked — the visuals still play.
  }
}

export default function PerfectDayCelebration() {
  const [day, setDay] = useState<PerfectDay | null>(null)
  const [pieces, setPieces] = useState<Piece[]>([])
  const [motion, setMotion] = useState(true)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const close = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    setDay(null)
  }, [])

  useEffect(() => {
    function onPerfectDay(e: Event) {
      const detail = (e as CustomEvent<PerfectDay>).detail
      if (!detail) return
      const m = motionAllowed()
      setMotion(m)
      setPieces(m ? randomPieces() : [])
      setDay(detail)
      haptic('success')
      if (feedbackAllowed()) playFanfare()
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(close, DURATION_MS)
    }
    window.addEventListener(PERFECT_DAY_EVENT, onPerfectDay)
    return () => {
      window.removeEventListener(PERFECT_DAY_EVENT, onPerfectDay)
      if (timer.current) clearTimeout(timer.current)
    }
  }, [close])

  if (!day || typeof document === 'undefined') return null

  const isToday = day.date === todayStr()

  return createPortal(
    <div
      role="dialog"
      aria-label="Perfect day"
      onClick={close}
      className="perfect-day-overlay fixed inset-0 z-[400] flex items-center justify-center overflow-hidden bg-[#06060f]/80 p-4 backdrop-blur-sm"
    >
      {motion && (
        <>
          <div className="perfect-day-glow pointer-events-none absolute left-1/2 top-1/2 h-[36rem] w-[36rem] rounded-full bg-[radial-gradient(circle,rgba(251,191,36,0.35),rgba(167,139,250,0.15)_45%,transparent_70%)]" />
          {pieces.map(p => (
            <span
              key={p.id}
              className={`perfect-day-piece pointer-events-none absolute -top-6 ${p.shape}`}
              style={{
                left: `${p.left}vw`,
                background: p.color,
                '--pd-drift': `${p.drift}px`,
                '--pd-rotate': `${p.rotate}deg`,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
              } as PieceStyle}
            />
          ))}
        </>
      )}

      <div className="perfect-day-card relative w-full max-w-xs rounded-3xl border border-amber-300/30 bg-slate-900/90 px-6 py-8 text-center shadow-2xl">
        <div className={`text-6xl ${motion ? 'perfect-day-trophy' : ''}`}>🏆</div>
        <p className="mt-4 text-2xl font-extrabold text-white">Perfect day!</p>
        <p className="mt-1 text-sm text-slate-300">
          {isToday ? 'Every habit done for today' : 'Every habit done for yesterday'}
          {day.habits > 0 && ` — ${day.habits}/${day.habits}`}
        </p>
        {day.streak > 1 && (
          <p className="mt-4 inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-300">
            🔥 {day.streak}-day perfect streak
          </p>
        )}
        <p className="mt-5 text-[11px] text-slate-500">Tap anywhere to continue</p>
      </div>
    </div>,
    document.body,
  )
}
