'use client'

import { useCallback, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import CoinBurst from '@/components/shared/CoinBurst'

const CELEBRATION_DURATION_MS = 1500

// Synthesizes a short two-tone "cha-ching" chime with the Web Audio API —
// no audio asset file, no new dependency. Silently no-ops if Web Audio
// isn't available or playback is blocked.
function playCoinChime() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    const AudioCtx = w.AudioContext ?? w.webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const now = ctx.currentTime

    const blip = (freq: number, start: number, dur: number) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now + start)
      gain.gain.setValueAtTime(0, now + start)
      gain.gain.linearRampToValueAtTime(0.25, now + start + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + start)
      osc.stop(now + start + dur)
    }

    blip(1046.5, 0,    0.12) // C6
    blip(1568.0, 0.09, 0.18) // G6

    setTimeout(() => ctx.close(), 500)
  } catch {
    // Audio unavailable/blocked — the visual burst still plays.
  }
}

export function useHabitCelebration() {
  const [active, setActive] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const celebrate = useCallback(() => {
    playCoinChime()
    setActive(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setActive(false), CELEBRATION_DURATION_MS)
  }, [])

  const celebrationNode = active && typeof document !== 'undefined'
    ? createPortal(<CoinBurst />, document.body)
    : null

  return { celebrate, celebrationNode }
}
