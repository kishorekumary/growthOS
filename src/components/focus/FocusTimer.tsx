'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Timer, Play, Pause, Square, Plus, Trash2, ChevronLeft, ChevronUp, ChevronDown,
  Loader2, Check, RotateCcw, Bell, Pencil, Copy, SkipForward, AlarmClock, X,
} from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { useCachedQuery } from '@/hooks/useCachedQuery'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useTimer, playAlarm, showNotification, type Sequence } from '@/contexts/TimerContext'
import EmptyState from '@/components/ui/empty-state'
import { focusMinutes, sessionProgress, stepTone, type StepTone } from '@/lib/focusSession'
import ListClearedBurst from '@/components/shared/ListClearedBurst'

// ─── Types ────────────────────────────────────────────────────

interface Step { label: string; duration: number }

// ─── Utilities ────────────────────────────────────────────────

function totalSecs(steps: Step[]) {
  return steps.reduce((a, s) => a + s.duration, 0)
}

function fmtDuration(secs: number) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0 && s > 0) return `${m}m ${s}s`
  if (m > 0) return `${m}m`
  return `${s}s`
}

// Whole-session time left: rounded up to minutes ("35m", "1h 5m").
function fmtLeft(secs: number) {
  const m = Math.ceil(secs / 60)
  const h = Math.floor(m / 60)
  return h ? `${h}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m}m`
}

function fmtCountdown(secs: number) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

// ─── Focus ring ───────────────────────────────────────────────

const TONE = {
  focus: { from: '#c4b5fd', to: '#6366f1', glow: 'rgba(129,140,248,0.55)', text: 'text-violet-300', aura: 'bg-violet-500/30', bar: 'from-violet-400 to-indigo-500' },
  break: { from: '#6ee7b7', to: '#14b8a6', glow: 'rgba(45,212,191,0.5)',   text: 'text-emerald-300', aura: 'bg-teal-500/30',   bar: 'from-emerald-300 to-teal-500' },
} as const

// The running step: a gradient arc that empties as time passes, a glowing
// head dot, and a soft halo that "breathes" while the timer runs.
function FocusRing({ progress, seconds, label, tone, paused }: {
  progress: number; seconds: number; label: string; tone: StepTone; paused: boolean
}) {
  const t = TONE[tone]
  const size = 260, r = 112, c = size / 2
  const circ = 2 * Math.PI * r
  const p = Math.max(0, Math.min(1, progress))
  const angle = p * 2 * Math.PI
  return (
    <div className="relative flex items-center justify-center">
      <div
        aria-hidden
        className={cn(
          'absolute h-52 w-52 rounded-full blur-3xl transition-opacity duration-700',
          t.aura,
          paused ? 'opacity-20' : 'animate-breathe motion-reduce:animate-none',
        )}
      />
      <svg viewBox={`0 0 ${size} ${size}`} className={cn('relative h-[260px] w-[260px] -rotate-90 transition-opacity duration-500', paused && 'opacity-50')}>
        <defs>
          <linearGradient id="focus-ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={t.from} />
            <stop offset="100%" stopColor={t.to} />
          </linearGradient>
        </defs>
        <circle cx={c} cy={c} r={r} fill="none" stroke="rgb(var(--c-white) / 0.06)" strokeWidth="10" />
        <circle
          cx={c} cy={c} r={r} fill="none" stroke="url(#focus-ring-grad)" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - p)}
          className="transition-[stroke-dashoffset] duration-1000 ease-linear"
          style={{ filter: `drop-shadow(0 0 8px ${t.glow})` }}
        />
        {p > 0.005 && (
          <circle
            cx={c + r * Math.cos(angle)} cy={c + r * Math.sin(angle)} r="7" fill="white"
            className="transition-all duration-1000 ease-linear"
            style={{ filter: `drop-shadow(0 0 6px ${t.glow})` }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-10 text-center">
        <span className={cn('text-[11px] font-semibold uppercase tracking-[0.2em]', paused ? 'animate-pulse text-slate-400' : t.text)}>
          {paused ? 'Paused' : tone === 'break' ? 'Break' : 'Focus'}
        </span>
        <span className="mt-1 text-5xl font-semibold leading-none tabular-nums text-white">{fmtCountdown(seconds)}</span>
        <span className="mt-2 line-clamp-2 max-w-[170px] text-base font-medium leading-snug text-slate-300">{label}</span>
      </div>
    </div>
  )
}

// The whole sequence as one bar: a segment per step, sized by its length,
// filling as the session goes.
function SessionBar({ steps, stepIdx, secondsLeft, paused }: {
  steps: Step[]; stepIdx: number; secondsLeft: number; paused: boolean
}) {
  const { segments, remaining } = sessionProgress(steps, stepIdx, secondsLeft)
  const endsAt = new Date(Date.now() + remaining * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return (
    <div className="w-full">
      <div className="flex h-2 gap-1">
        {segments.map((seg, i) => (
          <div key={i} className="relative min-w-[6px] overflow-hidden rounded-full bg-white/[0.07]" style={{ flexGrow: seg.share, flexBasis: 0 }}>
            <div
              className={cn('h-full rounded-full bg-gradient-to-r transition-[width] duration-1000 ease-linear', TONE[seg.tone].bar)}
              style={{ width: `${seg.filled * 100}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-slate-500">
        <span className="min-w-0 truncate">
          Step {stepIdx + 1} of {steps.length}
          {stepIdx < steps.length - 1 && <> · Next: <span className="text-slate-400">{steps[stepIdx + 1].label}</span></>}
        </span>
        <span className="shrink-0 tabular-nums">
          {fmtLeft(remaining)} left{!paused && <> · ends {endsAt}</>}
        </span>
      </div>
    </div>
  )
}

// ─── Sub-timer ────────────────────────────────────────────────

interface SubTimerState {
  label: string
  total: number
  left: number
  running: boolean
  done: boolean
}

const QUICK_MINS = [1, 2, 3, 5, 10]

function SubTimerPanel() {
  const [sub, setSub]           = useState<SubTimerState | null>(null)
  const [showCustom, setShowCustom] = useState(false)
  // Custom picker state
  const [customMins, setCustomMins] = useState(1)
  const [customSecs, setCustomSecs] = useState(0)
  const [customLabel, setCustomLabel] = useState('')
  const intervalRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const doneTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Countdown tick
  useEffect(() => {
    if (!sub?.running) return
    intervalRef.current = setInterval(() => {
      setSub(prev => {
        if (!prev?.running) return prev
        const next = prev.left - 1
        if (next <= 0) {
          playAlarm()
          showNotification(
            `⏱ Sub-timer done${prev.label ? ': ' + prev.label : ''}`,
            'Your sub-timer has finished.'
          )
          doneTimeoutRef.current = setTimeout(() => setSub(null), 4000)
          return { ...prev, left: 0, running: false, done: true }
        }
        return { ...prev, left: next }
      })
    }, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [sub?.running])

  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (doneTimeoutRef.current) clearTimeout(doneTimeoutRef.current)
  }, [])

  function launch(totalSecs: number, label = '') {
    if (totalSecs <= 0) return
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (doneTimeoutRef.current) clearTimeout(doneTimeoutRef.current)
    setSub({ label, total: totalSecs, left: totalSecs, running: true, done: false })
    setShowCustom(false)
  }

  function stopSub() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (doneTimeoutRef.current) clearTimeout(doneTimeoutRef.current)
    setSub(null)
    setShowCustom(false)
  }

  function togglePauseSub() {
    setSub(prev => prev ? { ...prev, running: !prev.running } : prev)
  }

  // ── Active sub-timer display
  if (sub) {
    const progress = sub.total > 0 ? sub.left / sub.total : 0
    const r = 22
    const circ = 2 * Math.PI * r

    return (
      <div className={cn(
        'w-full rounded-xl border px-4 py-3 transition-all',
        sub.done
          ? 'border-emerald-500/40 bg-emerald-500/10 animate-pulse'
          : 'border-amber-500/25 bg-amber-500/5',
      )}>
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <svg width="50" height="50" className="-rotate-90">
              <circle cx="25" cy="25" r={r} fill="none" stroke="rgb(var(--c-white) / 0.06)" strokeWidth="4" />
              <circle cx="25" cy="25" r={r} fill="none"
                stroke={sub.done ? '#10b981' : sub.running ? '#f59e0b' : '#64748b'}
                strokeWidth="4" strokeLinecap="round"
                strokeDasharray={circ}
                strokeDashoffset={circ * (1 - progress)}
                className="transition-[stroke-dashoffset] duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              {sub.done
                ? <Check className="h-4 w-4 text-emerald-400" />
                : <AlarmClock className="h-3 w-3 text-amber-400" />
              }
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-amber-400/70 font-medium mb-0.5">
              {sub.label || 'Sub-timer'}
            </p>
            {sub.done
              ? <p className="text-sm font-bold text-emerald-400">Done!</p>
              : <p className="text-2xl font-bold tabular-nums text-white leading-none">{fmtCountdown(sub.left)}</p>
            }
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {!sub.done && (
              <button onClick={togglePauseSub}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                {sub.running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </button>
            )}
            <button onClick={stopSub}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Custom picker (when ✏ is open)
  if (showCustom) {
    return (
      <div className="w-full rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-amber-400 flex items-center gap-1.5">
            <AlarmClock className="h-3.5 w-3.5" /> Custom sub-timer
          </p>
          <button onClick={() => setShowCustom(false)} className="text-slate-600 hover:text-slate-400 transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* [-] [MM] [+] : [-] [SS] [+] */}
        <div className="flex items-center justify-center gap-2">
          {/* Minutes */}
          <button
            onClick={() => setCustomMins(m => Math.max(0, m - 1))}
            disabled={customMins === 0}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-xl text-slate-300 hover:bg-white/10 hover:text-white transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed">
            −
          </button>
          <div className="flex flex-col items-center">
            <input
              type="number"
              min={0} max={99}
              value={customMins}
              onChange={e => setCustomMins(Math.max(0, Math.min(99, parseInt(e.target.value) || 0)))}
              className={cn(
                'w-14 bg-transparent text-center text-3xl font-bold text-white focus:outline-none',
                '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
              )}
            />
            <span className="text-[11px] text-slate-500 -mt-1">min</span>
          </div>
          <button
            onClick={() => setCustomMins(m => Math.min(99, m + 1))}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-xl text-slate-300 hover:bg-white/10 hover:text-white transition-all active:scale-95">
            +
          </button>

          <span className="text-2xl font-bold text-slate-600 mx-1">:</span>

          {/* Seconds */}
          <button
            onClick={() => setCustomSecs(s => s === 0 ? 59 : s - 1)}
            disabled={customMins === 0 && customSecs === 0}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-xl text-slate-300 hover:bg-white/10 hover:text-white transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed">
            −
          </button>
          <div className="flex flex-col items-center">
            <input
              type="number"
              min={0} max={59}
              value={customSecs}
              onChange={e => setCustomSecs(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
              className={cn(
                'w-14 bg-transparent text-center text-3xl font-bold text-white focus:outline-none',
                '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
              )}
            />
            <span className="text-[11px] text-slate-500 -mt-1">sec</span>
          </div>
          <button
            onClick={() => setCustomSecs(s => s === 59 ? 0 : s + 1)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-xl text-slate-300 hover:bg-white/10 hover:text-white transition-all active:scale-95">
            +
          </button>
        </div>

        {/* Optional label */}
        <input
          value={customLabel}
          onChange={e => setCustomLabel(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') launch(customMins * 60 + customSecs, customLabel.trim())
          }}
          placeholder="Label (optional)"
          className="w-full bg-transparent text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none border-b border-white/10 pb-1 text-center"
        />

        <button
          onClick={() => launch(customMins * 60 + customSecs, customLabel.trim())}
          disabled={customMins === 0 && customSecs === 0}
          className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed py-2 text-xs font-semibold text-black transition-colors active:scale-[0.98]">
          <Play className="h-3 w-3" />
          Start {customMins > 0 && customSecs > 0
            ? `${customMins}m ${customSecs}s`
            : customMins > 0 ? `${customMins}m` : `${customSecs}s`} timer
        </button>
      </div>
    )
  }

  // ── Quick-start chips (default idle state)
  return (
    <div className="w-full flex items-center gap-1.5 flex-wrap">
      <AlarmClock className="h-3.5 w-3.5 text-slate-600 shrink-0" />
      {QUICK_MINS.map(m => (
        <button
          key={m}
          onClick={() => launch(m * 60)}
          className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-400 hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-300 transition-all active:scale-95">
          +{m}m
        </button>
      ))}
      <button
        onClick={() => setShowCustom(true)}
        className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-500 hover:border-white/20 hover:text-slate-300 transition-all ml-auto">
        <Plus className="h-3 w-3" /> custom
      </button>
    </div>
  )
}

// ─── Step builder row ─────────────────────────────────────────

function StepRow({ step, index, total, onChange, onRemove, onMoveUp, onMoveDown }: {
  step: Step; index: number; total: number
  onChange: (field: 'label' | 'duration', value: string | number) => void
  onRemove: () => void; onMoveUp?: () => void; onMoveDown?: () => void
}) {
  const mins = Math.floor(step.duration / 60)
  const secs = step.duration % 60
  const [mStr, setMStr] = useState(String(mins))
  const [sStr, setSStr] = useState(String(secs))
  useEffect(() => { setMStr(String(Math.floor(step.duration / 60))) }, [step.duration])

  function commitMins(val: string) {
    const n = Math.max(0, Math.min(99, parseInt(val) || 0))
    setMStr(String(n)); onChange('duration', n * 60 + secs)
  }
  function commitSecs(val: string) {
    const n = Math.max(0, Math.min(59, parseInt(val) || 0))
    setSStr(String(n)); onChange('duration', mins * 60 + n)
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5">
      <div className="flex flex-col shrink-0">
        <button type="button" onClick={onMoveUp} disabled={index === 0}
          className={cn('flex h-4 w-4 items-center justify-center rounded transition-colors',
            index === 0 ? 'text-slate-800 cursor-not-allowed' : 'text-slate-500 hover:text-white hover:bg-white/10')}>
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={onMoveDown} disabled={index === total - 1}
          className={cn('flex h-4 w-4 items-center justify-center rounded transition-colors',
            index === total - 1 ? 'text-slate-800 cursor-not-allowed' : 'text-slate-500 hover:text-white hover:bg-white/10')}>
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>
      <span className="text-xs text-slate-600 w-5 shrink-0 text-center">{index + 1}.</span>
      <input value={step.label} onChange={e => onChange('label', e.target.value)}
        placeholder="Step name"
        className="flex-1 min-w-0 bg-transparent text-sm text-white placeholder:text-slate-600 focus:outline-none" />
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="flex flex-col items-center gap-0.5">
          <input type="number" min={0} max={99} value={mStr}
            onChange={e => setMStr(e.target.value)}
            onBlur={e => commitMins(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commitMins(mStr) }}
            className={cn('w-14 rounded border border-white/15 bg-slate-800 px-2 py-1 text-center text-sm font-medium text-white focus:outline-none focus:border-violet-500',
              '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none')} />
          <span className="text-[10px] text-slate-600 leading-none">min</span>
        </div>
        <span className="text-slate-500 font-medium text-base leading-none pb-3">:</span>
        <div className="flex flex-col items-center gap-0.5">
          <input type="number" min={0} max={59} value={sStr}
            onChange={e => setSStr(e.target.value)}
            onBlur={e => commitSecs(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commitSecs(sStr) }}
            className={cn('w-14 rounded border border-white/15 bg-slate-800 px-2 py-1 text-center text-sm font-medium text-white focus:outline-none focus:border-violet-500',
              '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none')} />
          <span className="text-[10px] text-slate-600 leading-none">sec</span>
        </div>
      </div>
      {total > 1 && (
        <button type="button" onClick={onRemove}
          className="shrink-0 ml-1 text-slate-700 hover:text-red-400 transition-colors">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

// ─── Sequence order (persisted in localStorage, no schema change) ─────────────

const LS_ORDER_KEY = 'focus_seq_order'

function applyStoredOrder(seqs: Sequence[]): Sequence[] {
  try {
    const stored: string[] = JSON.parse(localStorage.getItem(LS_ORDER_KEY) ?? '[]')
    if (!stored.length) return seqs
    const map = new Map(seqs.map(s => [s.id, s]))
    const ordered = stored.flatMap(id => (map.has(id) ? [map.get(id)!] : []))
    const remaining = seqs.filter(s => !stored.includes(s.id))
    return [...ordered, ...remaining]
  } catch { return seqs }
}

function saveOrder(seqs: Sequence[]) {
  localStorage.setItem(LS_ORDER_KEY, JSON.stringify(seqs.map(s => s.id)))
}

// ─── Main component ───────────────────────────────────────────

type LocalMode = 'list' | 'build'

const DEFAULT_STEPS: Step[] = [
  { label: 'Focus',       duration: 25 * 60 },
  { label: 'Short break', duration: 5  * 60 },
]

export default function FocusTimer() {
  // Timer engine lives in context — persists across navigation
  const { runSeq, stepIdx, secondsLeft, paused, done, startSequence, togglePause, stopTimer, skipStep, restartStep } = useTimer()

  const [mode, setMode]           = useState<LocalMode>('list')

  // Build / edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [seqName, setSeqName]     = useState('')
  const [steps, setSteps]         = useState<Step[]>(DEFAULT_STEPS)
  const [saving, setSaving]       = useState(false)

  const {
    data: sequences,
    loading,
    isOffline,
    refetch: fetchSeqs,
    setData: setSequences,
  } = useCachedQuery<Sequence[]>(
    'focus_sequences',
    (supabase, userId) =>
      supabase
        .from('focus_sequences')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .then(({ data, error }) => ({ data: data ? applyStoredOrder(data as Sequence[]) : data, error })),
    [],
    []
  )

  // Move the completed sequence to the bottom of the list
  useEffect(() => {
    if (!done || !runSeq) return
    setSequences(prev => {
      const match = prev.find(s => s.id === runSeq.id)
      if (!match) return prev
      const next = [...prev.filter(s => s.id !== runSeq.id), match]
      saveOrder(next)
      return next
    })
  }, [done, runSeq])

  // Keyboard pause/resume: MediaPlayPause, Space, or P while timer is running
  useEffect(() => {
    if (!runSeq || done) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'MediaPlayPause' ||
          (e.key === ' ' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA' && document.activeElement?.tagName !== 'BUTTON') ||
          (e.key === 'p' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA')) {
        e.preventDefault()
        togglePause()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [runSeq, done, togglePause])

  // ── Sequence CRUD ─────────────────────────────────────────

  function openNew() { setEditingId(null); setSeqName(''); setSteps([...DEFAULT_STEPS]); setMode('build') }

  function openEdit(seq: Sequence) {
    setEditingId(seq.id); setSeqName(seq.name)
    setSteps(seq.steps.map(s => ({ ...s }))); setMode('build')
  }

  async function duplicateSequence(seq: Sequence) {
    const supabase = createSupabaseBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return
    await supabase.from('focus_sequences').insert({ user_id: session.user.id, name: `Copy of ${seq.name}`, steps: seq.steps })
    fetchSeqs()
  }

  async function saveSequence() {
    if (!seqName.trim() || steps.length === 0 || steps.some(s => s.duration === 0)) return
    setSaving(true)
    const supabase = createSupabaseBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setSaving(false); return }
    if (editingId) {
      await supabase.from('focus_sequences').update({ name: seqName.trim(), steps, updated_at: new Date().toISOString() }).eq('id', editingId)
    } else {
      await supabase.from('focus_sequences').insert({ user_id: session.user.id, name: seqName.trim(), steps })
    }
    setSaving(false); setEditingId(null); setSeqName(''); setSteps([...DEFAULT_STEPS]); setMode('list')
    fetchSeqs()
  }

  function moveSequence(from: number, to: number) {
    setSequences(prev => {
      const next = [...prev]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      saveOrder(next)
      return next
    })
  }

  async function deleteSequence(id: string) {
    setSequences(prev => {
      const next = prev.filter(s => s.id !== id)
      saveOrder(next)
      return next
    })
    const supabase = createSupabaseBrowserClient()
    await supabase.from('focus_sequences').delete().eq('id', id)
  }

  function updateStep(idx: number, field: 'label' | 'duration', value: string | number) {
    setSteps(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s))
  }

  function moveStep(from: number, to: number) {
    setSteps(prev => { const next = [...prev]; const [r] = next.splice(from, 1); next.splice(to, 0, r); return next })
  }

  // ── Render ────────────────────────────────────────────────

  // ── Run mode (driven by global context) ───────────────────
  // Check runSeq before loading so navigating back mid-session shows the timer immediately
  if (runSeq) {
    const step     = runSeq.steps[stepIdx]
    const progress = step ? secondsLeft / step.duration : 0
    const tone     = stepTone(step?.label ?? '')

    return (
      <div className="flex flex-col items-center gap-5">
        {!done && (
          <div className="flex w-full items-center justify-between">
            <p className="text-sm font-semibold text-white">{runSeq.name}</p>
            <button onClick={stopTimer}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-400 transition-colors">
              <Square className="h-3.5 w-3.5" /> End session
            </button>
          </div>
        )}

        {done ? (
          <div className="relative flex w-full flex-col items-center py-6 text-center">
            <ListClearedBurst card={false} />
            <div aria-hidden className="absolute top-6 h-40 w-40 rounded-full bg-emerald-500/25 blur-3xl animate-breathe motion-reduce:animate-none" />
            <div className="relative flex h-24 w-24 animate-pop items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 shadow-[0_10px_40px_-8px_rgba(16,185,129,0.7)]">
              <Check className="h-12 w-12 text-snow" strokeWidth={3} />
            </div>
            <p className="relative mt-5 text-2xl font-bold text-white">Session complete</p>
            <p className="relative mt-1 text-sm text-slate-400">{runSeq.name}</p>

            <div className="relative mt-6 grid w-full grid-cols-3 gap-2">
              {([
                ['Focused', `${focusMinutes(runSeq.steps)}m`],
                ['Breaks',  `${Math.round(runSeq.steps.filter(x => stepTone(x.label) === 'break').reduce((a, x) => a + x.duration, 0) / 60)}m`],
                ['Steps',   String(runSeq.steps.length)],
              ] as const).map(([label, value]) => (
                <div key={label} className="rounded-xl border border-white/8 bg-white/[0.04] px-3 py-3">
                  <p className="text-xl font-bold text-white tabular-nums">{value}</p>
                  <p className="text-[11px] text-slate-500">{label}</p>
                </div>
              ))}
            </div>

            <p className="relative mt-5 text-sm text-emerald-300">Deep work done. Give yourself a moment before the next thing 🌿</p>

            <div className="relative mt-6 flex w-full gap-2">
              <button onClick={stopTimer}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/10 active:scale-[0.98] transition">
                Done
              </button>
              <button onClick={() => startSequence(runSeq)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 py-2.5 text-sm font-semibold text-snow shadow-[0_8px_24px_-8px_rgba(99,102,241,0.7)] active:scale-[0.98] transition">
                <RotateCcw className="h-4 w-4" /> Run again
              </button>
            </div>
          </div>
        ) : (
          <>
            <FocusRing progress={progress} seconds={secondsLeft} label={step?.label ?? ''} tone={tone} paused={paused} />

            <SessionBar steps={runSeq.steps} stepIdx={stepIdx} secondsLeft={secondsLeft} paused={paused} />

            <div className="flex items-center gap-4">
              <button onClick={restartStep} title="Restart this step" aria-label="Restart this step"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-400 hover:border-white/20 hover:text-white active:scale-95 transition-all">
                <RotateCcw className="h-4 w-4" />
              </button>
              <button onClick={togglePause} aria-label={paused ? 'Resume' : 'Pause'}
                className={cn(
                  'flex h-[72px] w-[72px] items-center justify-center rounded-full bg-gradient-to-br text-snow transition-all active:scale-95',
                  tone === 'break' ? 'from-emerald-400 to-teal-600 shadow-[0_8px_30px_-6px_rgba(20,184,166,0.6)]' : 'from-violet-500 to-indigo-600 shadow-[0_8px_30px_-6px_rgba(99,102,241,0.65)]',
                  paused && 'animate-pulse motion-reduce:animate-none',
                )}>
                {paused ? <Play className="ml-1 h-7 w-7" fill="currentColor" /> : <Pause className="h-7 w-7" fill="currentColor" />}
              </button>
              {stepIdx < runSeq.steps.length - 1 ? (
                <button onClick={skipStep} title="Skip to next step" aria-label="Skip to next step"
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-400 hover:border-amber-400/40 hover:text-amber-300 active:scale-95 transition-all">
                  <SkipForward className="h-4 w-4" />
                </button>
              ) : (
                <button onClick={stopTimer} title="End session" aria-label="End session"
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 active:scale-95 transition-all">
                  <Square className="h-4 w-4" />
                </button>
              )}
            </div>

            {'Notification' in window && Notification.permission === 'denied' && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
                <Bell className="h-3.5 w-3.5 shrink-0" />
                Enable browser notifications to receive step alerts.
              </div>
            )}

            <SubTimerPanel />

            <div className="w-full space-y-1.5 pt-2">
              {runSeq.steps.map((s, i) => (
                <div key={i} className={cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all',
                  i < stepIdx   && 'text-slate-600',
                  i === stepIdx && (tone === 'break'
                    ? 'border border-emerald-500/20 bg-emerald-500/10 text-white font-medium'
                    : 'border border-violet-500/20 bg-violet-500/10 text-white font-medium'),
                  i > stepIdx   && 'text-slate-500')}>
                  {i < stepIdx   ? <Check className="h-3.5 w-3.5 text-emerald-500/60 shrink-0" />
                  : i === stepIdx ? <div className={cn('h-2 w-2 rounded-full shrink-0', paused ? 'bg-slate-500' : tone === 'break' ? 'bg-emerald-400 animate-pulse' : 'bg-violet-400 animate-pulse')} />
                  :                 <div className="h-2 w-2 rounded-full bg-slate-700 shrink-0" />}
                  <span className={cn('flex-1 truncate', i < stepIdx && 'line-through')}>{s.label}</span>
                  <span className="text-xs text-slate-600 shrink-0">{fmtDuration(s.duration)}</span>
                  {i === stepIdx && i < runSeq.steps.length - 1 && (
                    <button onClick={skipStep} title="Skip this step"
                      className="ml-1 text-slate-600 hover:text-amber-300 transition-colors">
                      <SkipForward className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    )
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
    </div>
  )

  // ── Build / edit mode ─────────────────────────────────────
  if (mode === 'build') {
    const canSave = seqName.trim().length > 0 && steps.length > 0 && steps.every(s => s.duration > 0)
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => { setMode('list'); setEditingId(null) }}
            className="text-slate-400 hover:text-white transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h2 className="font-semibold text-white">{editingId ? 'Edit Sequence' : 'New Sequence'}</h2>
        </div>

        <div className="space-y-1.5">
          <Label className="text-slate-300">Sequence name</Label>
          <Input autoFocus placeholder="e.g. Deep Work · 2h Block" value={seqName}
            onChange={e => setSeqName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && canSave) saveSequence() }}
            className="border-white/20 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-violet-500" />
        </div>

        <div className="space-y-2">
          <Label className="text-slate-300">Steps</Label>
          {steps.map((step, i) => (
            <StepRow key={i} step={step} index={i} total={steps.length}
              onChange={(f, v) => updateStep(i, f, v)}
              onRemove={() => setSteps(prev => prev.filter((_, idx) => idx !== i))}
              onMoveUp={i > 0 ? () => moveStep(i, i - 1) : undefined}
              onMoveDown={i < steps.length - 1 ? () => moveStep(i, i + 1) : undefined} />
          ))}
          <button type="button"
            onClick={() => setSteps(prev => [...prev, { label: 'Focus', duration: 25 * 60 }])}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-white/10 py-2.5 text-xs text-slate-500 hover:border-white/20 hover:text-slate-400 transition-all">
            <Plus className="h-3.5 w-3.5" /> Add step
          </button>
        </div>

        {steps.length > 0 && (
          <p className="text-xs text-slate-500 text-right">
            Total: <span className="text-slate-400 font-medium">{fmtDuration(totalSecs(steps))}</span>
          </p>
        )}

        <Button onClick={saveSequence} disabled={saving || !canSave}
          className="w-full bg-violet-600 hover:bg-violet-700 text-snow">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {editingId ? 'Save Changes' : 'Save Sequence'}
        </Button>
      </div>
    )
  }

  // ── List mode ─────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          {sequences.length} saved sequence{sequences.length !== 1 ? 's' : ''}
        </p>
        <Button size="sm" onClick={openNew} className="bg-violet-600 hover:bg-violet-700 text-snow gap-1.5">
          <Plus className="h-4 w-4" /> New Sequence
        </Button>
      </div>

      {'Notification' in window && Notification.permission === 'default' && (
        <button onClick={() => Notification.requestPermission()}
          className="flex w-full items-center gap-2 rounded-lg border border-violet-500/20 bg-violet-500/10 px-3 py-2.5 text-xs text-violet-300 hover:bg-violet-500/15 transition-all text-left">
          <Bell className="h-3.5 w-3.5 shrink-0" />
          Allow notifications to get alerted when each step ends
        </button>
      )}

      {sequences.length === 0 && isOffline ? (
        <div className="rounded-xl border border-dashed border-white/10 p-12 text-center">
          <Timer className="h-10 w-10 text-violet-400/30 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Can&apos;t load — you&apos;re offline.</p>
        </div>
      ) : sequences.length === 0 ? (
        <EmptyState
          icon={Timer}
          title="No focus sequences yet"
          hint="Build a sequence of timed intervals and go deep."
        />
      ) : (
        <div className="space-y-3">
          {sequences.map((seq, idx) => {
            const total = totalSecs(seq.steps)
            return (
              <div key={seq.id}
                className="group rounded-xl border border-white/10 bg-white/3 p-4 hover:border-white/20 transition-all">
                <div className="flex items-start gap-3">
                  <div className="flex flex-col shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => moveSequence(idx, idx - 1)} disabled={idx === 0} title="Move up"
                      className={cn('flex h-4 w-4 items-center justify-center rounded transition-colors',
                        idx === 0 ? 'text-slate-800 cursor-not-allowed' : 'text-slate-500 hover:text-white hover:bg-white/10')}>
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => moveSequence(idx, idx + 1)} disabled={idx === sequences.length - 1} title="Move down"
                      className={cn('flex h-4 w-4 items-center justify-center rounded transition-colors',
                        idx === sequences.length - 1 ? 'text-slate-800 cursor-not-allowed' : 'text-slate-500 hover:text-white hover:bg-white/10')}>
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 border border-violet-500/20">
                    <Timer className="h-4 w-4 text-violet-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{seq.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {seq.steps.length} step{seq.steps.length !== 1 ? 's' : ''} · {fmtDuration(total)}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {seq.steps.map((s, i) => (
                        <span key={i} className="text-[10px] rounded-full bg-white/5 border border-white/8 px-2 py-0.5 text-slate-400">
                          {s.label} · {fmtDuration(s.duration)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => openEdit(seq)} title="Edit"
                      className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 opacity-0 group-hover:opacity-100 hover:text-white hover:bg-white/8 transition-all">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => duplicateSequence(seq)} title="Duplicate"
                      className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 opacity-0 group-hover:opacity-100 hover:text-white hover:bg-white/8 transition-all">
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => deleteSequence(seq.id)} title="Delete"
                      className="flex h-7 w-7 items-center justify-center rounded-md text-slate-600 opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-red-500/10 transition-all">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <Button size="sm" onClick={() => startSequence(seq)}
                      className="bg-violet-600 hover:bg-violet-700 text-snow gap-1 ml-1">
                      <Play className="h-3.5 w-3.5" /> Start
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
