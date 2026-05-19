'use client'

import { createContext, useContext, useRef, useState, useEffect, ReactNode } from 'react'

export interface Step     { label: string; duration: number }
export interface Sequence { id: string; name: string; steps: Step[]; created_at: string }

// ─── Audio / notification helpers ────────────────────────────────────────────

function playAlarm() {
  try {
    const AudioCtx = window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AudioCtx()
    const tones: { freq: number; t: number; dur: number }[] = [
      { freq: 523.25,  t: 0,    dur: 0.55 },
      { freq: 659.25,  t: 0.22, dur: 0.55 },
      { freq: 783.99,  t: 0.44, dur: 0.55 },
      { freq: 1046.50, t: 1.05, dur: 0.65 },
      { freq: 1046.50, t: 1.90, dur: 0.65 },
    ]
    tones.forEach(({ freq, t, dur }) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.type = 'sine'; osc.frequency.value = freq
      const at = ctx.currentTime + t
      gain.gain.setValueAtTime(0, at)
      gain.gain.linearRampToValueAtTime(0.85, at + 0.04)
      gain.gain.exponentialRampToValueAtTime(0.001, at + dur)
      osc.start(at); osc.stop(at + dur + 0.05)
    })
  } catch { /* autoplay policy */ }
}

async function showNotification(title: string, body: string) {
  if (!('Notification' in window)) return
  if (Notification.permission === 'default') await Notification.requestPermission()
  if (Notification.permission === 'granted') {
    const n = new Notification(title, { body, icon: '/icon-192.png', silent: false })
    setTimeout(() => n.close(), 3000)
  }
}

function fmtDuration(secs: number) {
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0 && s > 0) return `${m}m ${s}s`
  if (m > 0) return `${m}m`
  return `${s}s`
}

// ─── Context interface ────────────────────────────────────────────────────────

interface TimerCtx {
  runSeq:      Sequence | null
  stepIdx:     number
  secondsLeft: number
  paused:      boolean
  done:        boolean
  startSequence: (seq: Sequence) => void
  togglePause:   () => void
  stopTimer:     () => void
  skipStep:      () => void
  restartStep:   () => void
}

const TimerContext = createContext<TimerCtx | null>(null)

export function useTimer() {
  const ctx = useContext(TimerContext)
  if (!ctx) throw new Error('useTimer must be used within TimerProvider')
  return ctx
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function TimerProvider({ children }: { children: ReactNode }) {
  const [runSeq,  setRunSeq]      = useState<Sequence | null>(null)
  const [stepIdx, setStepIdx]     = useState(0)
  const [secsLeft, setSecsState]  = useState(0)
  const [paused,  setPaused]      = useState(false)
  const [done,    setDone]        = useState(false)

  const runSeqRef     = useRef<Sequence | null>(null)
  const stepIdxRef    = useRef(0)
  const endTimeRef    = useRef(0)
  const workerRef     = useRef<Worker | null>(null)
  const advanceRef    = useRef<() => void>(() => {})
  const pausedRef     = useRef(false)
  const secsLeftRef   = useRef(0)

  function setSecondsLeft(v: number) { secsLeftRef.current = v; setSecsState(v) }

  // Spin up the Web Worker once — survives page navigation
  useEffect(() => {
    if (typeof Worker === 'undefined') return
    const w = new Worker('/timer-worker.js')
    w.onmessage = (e: MessageEvent) => {
      if (e.data.type === 'tick') setSecondsLeft(Math.ceil(e.data.remaining / 1000))
      else if (e.data.type === 'done') advanceRef.current()
    }
    workerRef.current = w
    return () => { w.terminate(); workerRef.current = null }
  }, [])

  // Request notification permission once
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  function advanceStep() {
    const seq = runSeqRef.current
    if (!seq) return
    const nextIdx = stepIdxRef.current + 1
    if (nextIdx >= seq.steps.length) {
      setDone(true)
      playAlarm()
      showNotification('Focus session complete! 🎉', `All ${seq.steps.length} steps finished. Great work!`)
      return
    }
    playAlarm()
    showNotification(
      `✓ ${seq.steps[stepIdxRef.current].label} done`,
      `Up next: ${seq.steps[nextIdx].label} — ${fmtDuration(seq.steps[nextIdx].duration)}`
    )
    stepIdxRef.current = nextIdx
    setStepIdx(nextIdx)
    endTimeRef.current = Date.now() + seq.steps[nextIdx].duration * 1000
    setSecondsLeft(seq.steps[nextIdx].duration)
    workerRef.current?.postMessage({ type: 'start', endTimeMs: endTimeRef.current })
  }
  advanceRef.current = advanceStep

  function startSequence(seq: Sequence) {
    if (!seq.steps.length) return
    runSeqRef.current  = seq
    stepIdxRef.current = 0
    pausedRef.current  = false
    setRunSeq(seq); setStepIdx(0); setDone(false); setPaused(false)
    setSecondsLeft(seq.steps[0].duration)
    endTimeRef.current = Date.now() + seq.steps[0].duration * 1000
    workerRef.current?.postMessage({ type: 'start', endTimeMs: endTimeRef.current })
  }

  function togglePause() {
    if (pausedRef.current) {
      endTimeRef.current = Date.now() + secsLeftRef.current * 1000
      pausedRef.current  = false; setPaused(false)
      workerRef.current?.postMessage({ type: 'start', endTimeMs: endTimeRef.current })
    } else {
      workerRef.current?.postMessage({ type: 'stop' })
      pausedRef.current = true; setPaused(true)
    }
  }

  function restartStep() {
    const seq = runSeqRef.current; if (!seq) return
    pausedRef.current = false; setPaused(false)
    const dur = seq.steps[stepIdxRef.current].duration
    endTimeRef.current = Date.now() + dur * 1000
    setSecondsLeft(dur)
    workerRef.current?.postMessage({ type: 'start', endTimeMs: endTimeRef.current })
  }

  function skipStep() {
    workerRef.current?.postMessage({ type: 'stop' })
    pausedRef.current = false; setPaused(false)
    advanceStep()
  }

  function stopTimer() {
    workerRef.current?.postMessage({ type: 'stop' })
    runSeqRef.current = null; pausedRef.current = false
    setRunSeq(null); setDone(false); setPaused(false)
  }

  return (
    <TimerContext.Provider value={{
      runSeq, stepIdx, secondsLeft: secsLeft, paused, done,
      startSequence, togglePause, stopTimer, skipStep, restartStep,
    }}>
      {children}
    </TimerContext.Provider>
  )
}
