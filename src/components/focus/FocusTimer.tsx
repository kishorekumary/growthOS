'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Timer, Play, Pause, Square, Plus, Trash2, ChevronLeft,
  Loader2, Check, GripVertical, RotateCcw, Bell, Pencil, Copy,
} from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────

interface Step {
  label: string
  duration: number  // seconds
}

interface Sequence {
  id: string
  name: string
  steps: Step[]
  created_at: string
}

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

function fmtCountdown(secs: number) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

// Three-tone ascending chime via Web Audio API
function playAlarm() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx  = new AudioCtx()
    const freqs = [523.25, 659.25, 783.99]  // C5 – E5 – G5
    freqs.forEach((freq, i) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = freq
      const t = ctx.currentTime + i * 0.22
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.45, t + 0.04)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55)
      osc.start(t)
      osc.stop(t + 0.6)
    })
  } catch { /* blocked by autoplay policy */ }
}

async function showNotification(title: string, body: string) {
  if (!('Notification' in window)) return
  if (Notification.permission === 'default') await Notification.requestPermission()
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/icon-192.png', silent: false })
  }
}

// ─── Circular countdown ring ──────────────────────────────────

function CircularTimer({ progress, label, seconds, color }: {
  progress: number
  label: string
  seconds: number
  color: string
}) {
  const r    = 84
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - Math.max(0, Math.min(1, progress)))

  return (
    <div className="relative">
      <svg width="210" height="210" className="-rotate-90">
        <circle cx="105" cy="105" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
        <circle
          cx="105" cy="105" r={r}
          fill="none" stroke="currentColor" strokeWidth="12" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          className={cn('transition-[stroke-dashoffset] duration-500', color)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
        <span className="text-[2.4rem] font-bold text-white tabular-nums leading-none">
          {fmtCountdown(seconds)}
        </span>
        <span className="text-xs text-slate-400 max-w-[130px] text-center truncate mt-1">{label}</span>
      </div>
    </div>
  )
}

// ─── Step builder row ─────────────────────────────────────────

function StepRow({ step, index, total, onChange, onRemove }: {
  step: Step
  index: number
  total: number
  onChange: (field: 'label' | 'duration', value: string | number) => void
  onRemove: () => void
}) {
  const mins = Math.floor(step.duration / 60)
  const secs = step.duration % 60

  // Use string state so the user can clear the field while typing
  const [mStr, setMStr] = useState(String(mins))
  const [sStr, setSStr] = useState(String(secs))

  // Keep local display in sync when parent resets steps (e.g. after save)
  useEffect(() => { setMStr(String(Math.floor(step.duration / 60))) }, [step.duration])

  function commitMins(val: string) {
    const n = Math.max(0, Math.min(99, parseInt(val) || 0))
    setMStr(String(n))
    onChange('duration', n * 60 + secs)
  }

  function commitSecs(val: string) {
    const n = Math.max(0, Math.min(59, parseInt(val) || 0))
    setSStr(String(n))
    onChange('duration', mins * 60 + n)
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5">
      <GripVertical className="h-4 w-4 text-slate-700 shrink-0" />
      <span className="text-xs text-slate-600 w-5 shrink-0 text-center">{index + 1}.</span>

      {/* Label */}
      <input
        value={step.label}
        onChange={e => onChange('label', e.target.value)}
        placeholder="Step name"
        className="flex-1 min-w-0 bg-transparent text-sm text-white placeholder:text-slate-600 focus:outline-none"
      />

      {/* Duration — minutes : seconds */}
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="flex flex-col items-center gap-0.5">
          <input
            type="number" min={0} max={99}
            value={mStr}
            onChange={e => setMStr(e.target.value)}
            onBlur={e => commitMins(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commitMins(mStr) }}
            className={cn(
              'w-14 rounded border border-white/15 bg-slate-800 px-2 py-1 text-center text-sm font-medium',
              'text-white focus:outline-none focus:border-violet-500',
              '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'
            )}
          />
          <span className="text-[10px] text-slate-600 leading-none">min</span>
        </div>
        <span className="text-slate-500 font-medium text-base leading-none pb-3">:</span>
        <div className="flex flex-col items-center gap-0.5">
          <input
            type="number" min={0} max={59}
            value={sStr}
            onChange={e => setSStr(e.target.value)}
            onBlur={e => commitSecs(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commitSecs(sStr) }}
            className={cn(
              'w-14 rounded border border-white/15 bg-slate-800 px-2 py-1 text-center text-sm font-medium',
              'text-white focus:outline-none focus:border-violet-500',
              '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'
            )}
          />
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

// ─── Main component ───────────────────────────────────────────

type Mode = 'list' | 'build' | 'run'

const DEFAULT_STEPS: Step[] = [
  { label: 'Focus',       duration: 25 * 60 },
  { label: 'Short break', duration: 5  * 60 },
]

export default function FocusTimer() {
  const [sequences, setSequences] = useState<Sequence[]>([])
  const [loading, setLoading]     = useState(true)
  const [mode, setMode]           = useState<Mode>('list')

  // Build / edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [seqName, setSeqName]     = useState('')
  const [steps, setSteps]         = useState<Step[]>(DEFAULT_STEPS)
  const [saving, setSaving]       = useState(false)

  // Run display state
  const [runSeq, setRunSeq]           = useState<Sequence | null>(null)
  const [stepIdx, setStepIdx]         = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [paused, setPaused]           = useState(false)
  const [done, setDone]               = useState(false)

  // Refs — read inside setInterval to avoid stale closures
  const runSeqRef  = useRef<Sequence | null>(null)
  const stepIdxRef = useRef(0)
  const endTimeRef = useRef(0)
  const tickerRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const pausedRef  = useRef(false)

  // ── Data ──────────────────────────────────────────────────
  const fetchSeqs = useCallback(async () => {
    const supabase = createSupabaseBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setLoading(false); return }
    const { data } = await supabase
      .from('focus_sequences')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
    setSequences((data as Sequence[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchSeqs() }, [fetchSeqs])

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  useEffect(() => () => {
    if (tickerRef.current) clearInterval(tickerRef.current)
  }, [])

  // ── Timer engine ──────────────────────────────────────────

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
    startTicker()
  }

  function startTicker() {
    if (tickerRef.current) clearInterval(tickerRef.current)
    tickerRef.current = setInterval(() => {
      if (pausedRef.current) return
      const remaining = Math.max(0, endTimeRef.current - Date.now())
      setSecondsLeft(Math.ceil(remaining / 1000))
      if (remaining === 0) {
        clearInterval(tickerRef.current!)
        tickerRef.current = null
        advanceStep()
      }
    }, 200)
  }

  // ── Controls ──────────────────────────────────────────────

  function startSequence(seq: Sequence) {
    if (!seq.steps.length) return
    runSeqRef.current  = seq
    stepIdxRef.current = 0
    pausedRef.current  = false
    setRunSeq(seq); setStepIdx(0); setDone(false); setPaused(false)
    setSecondsLeft(seq.steps[0].duration)
    setMode('run')
    endTimeRef.current = Date.now() + seq.steps[0].duration * 1000
    startTicker()
  }

  function togglePause() {
    if (pausedRef.current) {
      endTimeRef.current = Date.now() + secondsLeft * 1000
      pausedRef.current  = false
      setPaused(false)
    } else {
      pausedRef.current = true
      setPaused(true)
    }
  }

  function restartStep() {
    const seq = runSeqRef.current
    if (!seq) return
    pausedRef.current = false
    setPaused(false)
    const dur = seq.steps[stepIdxRef.current].duration
    endTimeRef.current = Date.now() + dur * 1000
    setSecondsLeft(dur)
    startTicker()
  }

  function stopTimer() {
    if (tickerRef.current) clearInterval(tickerRef.current)
    tickerRef.current = null
    runSeqRef.current  = null
    pausedRef.current  = false
    setMode('list'); setRunSeq(null); setDone(false); setPaused(false)
  }

  // ── Sequence CRUD ─────────────────────────────────────────

  function openNew() {
    setEditingId(null)
    setSeqName('')
    setSteps([...DEFAULT_STEPS])
    setMode('build')
  }

  function openEdit(seq: Sequence) {
    setEditingId(seq.id)
    setSeqName(seq.name)
    setSteps(seq.steps.map(s => ({ ...s })))
    setMode('build')
  }

  async function duplicateSequence(seq: Sequence) {
    const supabase = createSupabaseBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return
    await supabase.from('focus_sequences').insert({
      user_id: session.user.id,
      name:    `Copy of ${seq.name}`,
      steps:   seq.steps,
    })
    fetchSeqs()
  }

  async function saveSequence() {
    if (!seqName.trim() || steps.length === 0 || steps.some(s => s.duration === 0)) return
    setSaving(true)
    const supabase = createSupabaseBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setSaving(false); return }

    if (editingId) {
      await supabase.from('focus_sequences').update({
        name:       seqName.trim(),
        steps,
        updated_at: new Date().toISOString(),
      }).eq('id', editingId)
    } else {
      await supabase.from('focus_sequences').insert({
        user_id: session.user.id,
        name:    seqName.trim(),
        steps,
      })
    }

    setSaving(false)
    setEditingId(null)
    setSeqName('')
    setSteps([...DEFAULT_STEPS])
    setMode('list')
    fetchSeqs()
  }

  async function deleteSequence(id: string) {
    setSequences(prev => prev.filter(s => s.id !== id))
    const supabase = createSupabaseBrowserClient()
    await supabase.from('focus_sequences').delete().eq('id', id)
  }

  function updateStep(idx: number, field: 'label' | 'duration', value: string | number) {
    setSteps(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s))
  }

  // ── Render ────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
    </div>
  )

  // ── Run mode ──────────────────────────────────────────────
  if (mode === 'run' && runSeq) {
    const step     = runSeq.steps[stepIdx]
    const progress = step ? secondsLeft / step.duration : 0
    const ringColor = done ? 'text-emerald-400' : paused ? 'text-slate-500' : 'text-violet-400'

    return (
      <div className="flex flex-col items-center gap-5">
        <div className="flex w-full items-center justify-between">
          <p className="text-sm font-semibold text-white">{runSeq.name}</p>
          <button onClick={stopTimer}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-400 transition-colors">
            <Square className="h-3.5 w-3.5" /> End session
          </button>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500/15 border-2 border-emerald-500/50">
              <Check className="h-12 w-12 text-emerald-400" />
            </div>
            <p className="text-xl font-bold text-white">Session Complete!</p>
            <p className="text-sm text-slate-400">All {runSeq.steps.length} steps finished 🎉</p>
            <Button onClick={stopTimer} className="mt-2 bg-violet-600 hover:bg-violet-700 text-white px-8">Done</Button>
          </div>
        ) : (
          <>
            <CircularTimer progress={progress} label={step?.label ?? ''} seconds={secondsLeft} color={ringColor} />
            <p className="text-xs text-slate-500">Step {stepIdx + 1} of {runSeq.steps.length}</p>

            <div className="flex items-center gap-4">
              <button onClick={restartStep} title="Restart this step"
                className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-white/10 bg-white/5 text-slate-400 hover:border-white/20 hover:text-white transition-all">
                <RotateCcw className="h-4 w-4" />
              </button>
              <button onClick={togglePause}
                className={cn(
                  'flex h-14 w-14 items-center justify-center rounded-full border-2 transition-all',
                  paused
                    ? 'border-violet-400 bg-violet-500/20 text-violet-300 hover:bg-violet-500/30'
                    : 'border-white/20 bg-white/5 text-white hover:border-violet-400 hover:bg-violet-500/10'
                )}>
                {paused ? <Play className="h-6 w-6" /> : <Pause className="h-6 w-6" />}
              </button>
              <button onClick={stopTimer} title="End session"
                className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all">
                <Square className="h-4 w-4" />
              </button>
            </div>

            {'Notification' in window && Notification.permission === 'denied' && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
                <Bell className="h-3.5 w-3.5 shrink-0" />
                Enable browser notifications to receive step alerts.
              </div>
            )}

            <div className="w-full space-y-1.5 pt-2">
              {runSeq.steps.map((s, i) => (
                <div key={i} className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all',
                  i < stepIdx   && 'text-slate-600',
                  i === stepIdx && 'border border-violet-500/20 bg-violet-500/10 text-white font-medium',
                  i > stepIdx   && 'text-slate-500',
                )}>
                  {i < stepIdx   ? <Check className="h-3.5 w-3.5 text-emerald-500/60 shrink-0" />
                  : i === stepIdx ? <div className={cn('h-2 w-2 rounded-full shrink-0', paused ? 'bg-slate-500' : 'bg-violet-400 animate-pulse')} />
                  :                 <div className="h-2 w-2 rounded-full bg-slate-700 shrink-0" />}
                  <span className={cn('flex-1 truncate', i < stepIdx && 'line-through')}>{s.label}</span>
                  <span className="text-xs text-slate-600 shrink-0">{fmtDuration(s.duration)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    )
  }

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
          <h2 className="font-semibold text-white">
            {editingId ? 'Edit Sequence' : 'New Sequence'}
          </h2>
        </div>

        <div className="space-y-1.5">
          <Label className="text-slate-300">Sequence name</Label>
          <Input
            autoFocus
            placeholder="e.g. Deep Work · 2h Block"
            value={seqName}
            onChange={e => setSeqName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && canSave) saveSequence() }}
            className="border-white/20 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-violet-500"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-slate-300">Steps</Label>
          {steps.map((step, i) => (
            <StepRow
              key={i}
              step={step}
              index={i}
              total={steps.length}
              onChange={(f, v) => updateStep(i, f, v)}
              onRemove={() => setSteps(prev => prev.filter((_, idx) => idx !== i))}
            />
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
          className="w-full bg-violet-600 hover:bg-violet-700 text-white">
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
        <Button size="sm" onClick={openNew}
          className="bg-violet-600 hover:bg-violet-700 text-white gap-1.5">
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

      {sequences.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 p-12 text-center">
          <Timer className="h-10 w-10 text-violet-400/30 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No sequences yet.</p>
          <p className="text-slate-600 text-xs mt-1">Create a sequence of timed intervals to focus deeply.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sequences.map(seq => {
            const total = totalSecs(seq.steps)
            return (
              <div key={seq.id}
                className="group rounded-xl border border-white/10 bg-white/3 p-4 hover:border-white/20 transition-all">
                <div className="flex items-start gap-3">
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
                  {/* Action buttons — edit/duplicate always visible; delete on hover */}
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
                      className="bg-violet-600 hover:bg-violet-700 text-white gap-1 ml-1">
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
