'use client'

import { useState, useEffect, useRef, useMemo, type TouchEvent } from 'react'
import { Wind, Sparkles, Brain, X, ChevronLeft, ChevronRight, Loader2, RefreshCw, Zap, Target, CheckSquare, Circle, ScrollText, Leaf, Volume2, VolumeX } from 'lucide-react'
import { differenceInDays, parseISO } from 'date-fns'
import { completeItem, openNowQuery } from '@/lib/planner/actions'
import { periodStart } from '@/lib/planner/periods'
import type { PlannerItem } from '@/lib/planner/types'
import { todayStr } from '@/lib/habitStreak'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { useCachedQuery } from '@/hooks/useCachedQuery'
import { useDraggableFab } from '@/hooks/useDraggableFab'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { haptic } from '@/lib/effects'
import {
  BREATH_PATTERNS, SESSION_MINUTES, DEFAULT_PATTERN_ID, DEFAULT_MINUTES,
  patternById, patternCountsLabel, phasesOf, cyclesFor, sessionTimeline, formatClock,
  type BreathKind,
} from '@/lib/breathing'
import { createBreathSound, type BreathSound } from '@/lib/breathSound'

type Mode = 'menu' | 'breathing' | 'affirmations' | 'ai' | 'goals' | 'tasks' | 'identity' | 'grounding'

// ─── Breathing exercise ───────────────────────────────────────────
const BREATH_PREFS_KEY = 'growthos:breathing'

interface BreathPrefs { pattern: string; minutes: number; sound: boolean }

function readBreathPrefs(): BreathPrefs {
  const fallback = { pattern: DEFAULT_PATTERN_ID, minutes: DEFAULT_MINUTES, sound: true }
  try {
    const saved = JSON.parse(localStorage.getItem(BREATH_PREFS_KEY) ?? 'null') as Partial<BreathPrefs> | null
    if (!saved) return fallback
    return {
      pattern: patternById(saved.pattern).id,
      minutes: (SESSION_MINUTES as readonly number[]).includes(saved.minutes ?? -1) ? saved.minutes! : DEFAULT_MINUTES,
      sound:   saved.sound !== false,
    }
  } catch {
    return fallback
  }
}

// Per-phase look: the circle grows on inhale, rests on hold, shrinks on exhale.
const BREATH_STYLE: Record<BreathKind, { text: string; ring: string; core: string }> = {
  inhale: { text: 'text-sky-300',    ring: 'border-sky-400/50 bg-sky-500/10',       core: 'bg-sky-500/25' },
  hold:   { text: 'text-amber-200',  ring: 'border-amber-300/50 bg-amber-400/10',   core: 'bg-amber-400/20' },
  exhale: { text: 'text-violet-300', ring: 'border-violet-400/50 bg-violet-500/10', core: 'bg-violet-500/25' },
}

function BreathingExercise() {
  const [prefs, setPrefs]     = useState<BreathPrefs>({ pattern: DEFAULT_PATTERN_ID, minutes: DEFAULT_MINUTES, sound: true })
  const [status, setStatus]   = useState<'setup' | 'running' | 'done'>('setup')
  const [stepIdx, setStepIdx] = useState(0)
  const soundRef = useRef<BreathSound | null>(null)

  useEffect(() => { setPrefs(readBreathPrefs()) }, [])

  function updatePrefs(patch: Partial<BreathPrefs>) {
    setPrefs(prev => {
      const next = { ...prev, ...patch }
      try { localStorage.setItem(BREATH_PREFS_KEY, JSON.stringify(next)) } catch { /* storage unavailable */ }
      return next
    })
  }

  const pattern  = patternById(prefs.pattern)
  const phases   = useMemo(() => phasesOf(pattern), [pattern])
  const timeline = useMemo(() => sessionTimeline(pattern, prefs.minutes), [pattern, prefs.minutes])
  const cycles   = cyclesFor(pattern, prefs.minutes)

  function begin() {
    // Created inside the tap so browsers allow it to play.
    soundRef.current?.close()
    soundRef.current = createBreathSound(!prefs.sound)
    setStepIdx(-1)
    setStatus('running')
  }

  function toggleSound() {
    const sound = !prefs.sound
    updatePrefs({ sound })
    soundRef.current?.setMuted(!sound)
  }

  // Ticks off whole seconds against the start time, so a slow timer never
  // drifts the session; each phase's cue plays on its first second.
  useEffect(() => {
    if (status !== 'running') return
    const startedAt = performance.now()
    let shown = -1
    function cue(i: number) {
      const step  = timeline[i]
      const phase = phases[step.phaseIndex]
      const sound = soundRef.current
      if (step.starts) {
        haptic('tick')
        if (phase.kind === 'inhale') sound?.inhale(phase.seconds)
        else if (phase.kind === 'exhale') sound?.exhale(phase.seconds)
        else sound?.hold()
      } else if (phase.kind === 'hold') {
        sound?.tick()
      }
    }
    const id = setInterval(() => {
      const i = Math.floor((performance.now() - startedAt) / 1000)
      if (i === shown) return
      if (i >= timeline.length) {
        clearInterval(id)
        soundRef.current?.finish()
        haptic('success')
        setStatus('done')
        return
      }
      shown = i
      setStepIdx(i)
      cue(i)
    }, 100)
    return () => clearInterval(id)
  }, [status, timeline, phases])

  // Release the audio device when the session stops or the sheet closes.
  useEffect(() => {
    if (status === 'running') return
    soundRef.current?.close()
    soundRef.current = null
  }, [status])
  useEffect(() => () => { soundRef.current?.close() }, [])

  const soundToggle = (
    <button
      type="button"
      onClick={toggleSound}
      aria-label={prefs.sound ? 'Mute breathing sounds' : 'Turn on breathing sounds'}
      className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-400 hover:text-white"
    >
      {prefs.sound ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
      {prefs.sound ? 'Sound on' : 'Sound off'}
    </button>
  )

  if (status === 'setup') {
    return (
      <div className="flex flex-col gap-5 py-2">
        <div className="text-center space-y-1">
          <p className="text-white font-semibold">Breathing</p>
          <p className="text-slate-400 text-xs">{phases.map(ph => `${ph.label} ${ph.seconds}s`).join(' · ')}</p>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-slate-500">Pattern</p>
          <div className="grid grid-cols-2 gap-2">
            {BREATH_PATTERNS.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => updatePrefs({ pattern: p.id })}
                aria-pressed={p.id === pattern.id}
                className={cn(
                  'rounded-xl border px-3 py-2.5 text-left transition-colors',
                  p.id === pattern.id
                    ? 'border-blue-400/60 bg-blue-500/15'
                    : 'border-white/10 bg-white/5 hover:border-white/20',
                )}
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-white">{p.name}</span>
                  <span className="text-xs tabular-nums text-blue-300">{patternCountsLabel(p)}</span>
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-slate-400">{p.blurb}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-slate-500">Length</p>
          <div className="grid grid-cols-4 gap-2">
            {SESSION_MINUTES.map(m => (
              <button
                key={m}
                type="button"
                onClick={() => updatePrefs({ minutes: m })}
                aria-pressed={m === prefs.minutes}
                className={cn(
                  'rounded-lg border py-2 text-sm transition-colors',
                  m === prefs.minutes
                    ? 'border-blue-400/60 bg-blue-500/15 text-white'
                    : 'border-white/10 bg-white/5 text-slate-400 hover:text-white',
                )}
              >
                {m} min
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-500">{cycles} breath{cycles !== 1 ? 's' : ''} · {formatClock(timeline.length)}</p>
        </div>

        <div className="flex items-center justify-between">
          {soundToggle}
          <Button onClick={begin} className="bg-blue-600 hover:bg-blue-700 text-snow px-8">
            <Wind className="mr-2 h-4 w-4" /> Begin
          </Button>
        </div>
      </div>
    )
  }

  if (status === 'done') {
    return (
      <div className="flex flex-col items-center gap-5 py-8 text-center">
        <Leaf className="h-8 w-8 text-emerald-400" />
        <div className="space-y-1">
          <p className="text-white font-semibold">Nicely done</p>
          <p className="text-slate-400 text-sm">
            {cycles} {pattern.name} breath{cycles !== 1 ? 's' : ''} · {formatClock(timeline.length)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={begin} className="bg-blue-600 hover:bg-blue-700 text-snow">
            <RefreshCw className="mr-2 h-4 w-4" /> Again
          </Button>
          <Button
            variant="outline"
            onClick={() => setStatus('setup')}
            className="border-white/20 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10"
          >
            Change
          </Button>
        </div>
      </div>
    )
  }

  // -1 until the first second ticks, so the opening inhale grows from small.
  const shownIdx = Math.max(stepIdx, 0)
  const step  = timeline[shownIdx]
  const phase = phases[step.phaseIndex]
  const look  = BREATH_STYLE[phase.kind]
  // A hold keeps the size of the breath before it.
  const expanded = stepIdx >= 0 && (phase.kind === 'inhale' || (phase.kind === 'hold' && phases[step.phaseIndex - 1]?.kind === 'inhale'))
  // Size moves for the whole breath; colour switches quickly at each phase.
  const sizeMs = phase.kind === 'hold' ? 300 : phase.seconds * 1000
  const sizeTransition = { transitionDuration: `${sizeMs}ms, 500ms, 500ms` }

  return (
    <div className="flex flex-col items-center gap-5 py-4">
      <div className="text-center">
        <p className={cn('text-2xl font-light tracking-widest transition-colors duration-500', look.text)}>{phase.label}</p>
        <p className="text-slate-500 text-xs mt-1 tabular-nums">
          Breath {step.cycle + 1} of {cycles} · {formatClock(timeline.length - shownIdx)} left
        </p>
      </div>

      <div className="relative flex items-center justify-center w-48 h-48">
        <div
          className={cn('absolute w-44 h-44 rounded-full border-2 ease-in-out transition-[transform,background-color,border-color]', look.ring, expanded ? 'scale-100' : 'scale-[0.45]')}
          style={sizeTransition}
        />
        <div
          className={cn('absolute w-28 h-28 rounded-full ease-in-out transition-[transform,background-color]', look.core, expanded ? 'scale-100' : 'scale-[0.36]')}
          style={sizeTransition}
        />
        <p key={stepIdx} className={cn('relative z-10 text-3xl font-light tabular-nums animate-pop motion-reduce:animate-none', look.text)}>
          {step.remaining}
        </p>
      </div>

      <div className="h-1 w-48 overflow-hidden rounded-full bg-white/5">
        <div className="h-full rounded-full bg-blue-400/60 transition-all duration-1000 ease-linear" style={{ width: `${((stepIdx + 1) / timeline.length) * 100}%` }} />
      </div>

      <div className="flex items-center gap-2">
        {soundToggle}
        <Button
          variant="outline"
          onClick={() => setStatus('setup')}
          className="border-white/20 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10"
        >
          Stop
        </Button>
      </div>
    </div>
  )
}

// ─── Affirmations flash ───────────────────────────────────────────
function AffirmationsFlash() {
  const { data: affirmationsRow, loading, isOffline } = useCachedQuery<{ affirmations: string[] | null } | null>(
    'daily-practice:affirmations',
    (supabase, userId) => supabase
      .from('daily_practice')
      .select('affirmations')
      .eq('user_id', userId)
      .maybeSingle(),
    null,
    []
  )
  const affirmations = affirmationsRow?.affirmations ?? []
  const [index, setIndex]   = useState(0)
  const [fading, setFading]   = useState(false)
  const touchStartX = useRef<number | null>(null)

  function go(dir: 1 | -1) {
    setFading(true)
    setTimeout(() => {
      setIndex(i => (i + dir + affirmations.length) % affirmations.length)
      setFading(false)
    }, 250)
  }

  function jumpTo(i: number) {
    setFading(true)
    setTimeout(() => { setIndex(i); setFading(false) }, 250)
  }

  if (loading) {
    return <div className="flex justify-center py-14"><Loader2 className="h-5 w-5 animate-spin text-slate-500" /></div>
  }

  if (affirmations.length === 0 && isOffline) {
    return (
      <div className="text-center py-10 space-y-3">
        <Sparkles className="h-8 w-8 text-violet-400/40 mx-auto" />
        <p className="text-slate-400 text-sm">Can&rsquo;t load — you&rsquo;re offline.</p>
      </div>
    )
  }

  if (affirmations.length === 0) {
    return (
      <div className="text-center py-10 space-y-3">
        <Sparkles className="h-8 w-8 text-violet-400/40 mx-auto" />
        <p className="text-slate-400 text-sm">No affirmations saved yet.</p>
        <p className="text-slate-500 text-xs">Add some in Daily Practice on the dashboard.</p>
      </div>
    )
  }

  function onTouchStart(e: TouchEvent<HTMLDivElement>) {
    touchStartX.current = e.touches[0].clientX
  }
  function onTouchEnd(e: TouchEvent<HTMLDivElement>) {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) > 40) dx < 0 ? go(1) : go(-1)
    touchStartX.current = null
  }

  return (
    <div className="flex flex-col items-center gap-6 py-4" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <p className="text-[11px] text-violet-400/60 uppercase tracking-widest">
        {index + 1} of {affirmations.length}
      </p>

      <div className={cn(
        'min-h-[100px] flex items-center justify-center px-4 transition-opacity duration-[250ms]',
        fading ? 'opacity-0' : 'opacity-100',
      )}>
        <blockquote className="text-center text-2xl font-semibold text-white leading-relaxed italic drop-shadow-[0_0_20px_rgba(167,139,250,0.4)]">
          &ldquo;{affirmations[index]}&rdquo;
        </blockquote>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={() => go(-1)}
          className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-500 hover:text-white transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div className="flex gap-1.5 items-center">
          {affirmations.map((_, i) => (
            <button
              key={i}
              onClick={() => jumpTo(i)}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                i === index ? 'w-4 bg-violet-400' : 'w-1.5 bg-white/20 hover:bg-white/40',
              )}
            />
          ))}
        </div>

        <button
          onClick={() => go(1)}
          className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-500 hover:text-white transition-colors"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}

// ─── AI reset message ─────────────────────────────────────────────
function AIResetMessage() {
  const [context, setContext] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone]       = useState(false)

  async function generate() {
    setLoading(true)
    try {
      const res = await fetch('/api/ai/reset-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: context.trim() }),
      })
      const data = await res.json()
      setMessage(data.message ?? fallback)
      setDone(true)
    } catch {
      setMessage(fallback)
      setDone(true)
    } finally {
      setLoading(false)
    }
  }

  if (!done) {
    return (
      <div className="flex flex-col gap-5 py-2">
        <div className="text-center space-y-1">
          <p className="text-white font-semibold">What&rsquo;s going on?</p>
          <p className="text-slate-400 text-sm">Optional — share what you&rsquo;re feeling</p>
        </div>

        <textarea
          value={context}
          onChange={e => setContext(e.target.value)}
          placeholder="I'm feeling overwhelmed with work..."
          rows={3}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-600 resize-none focus:outline-none focus:ring-1 focus:ring-violet-500"
        />

        <Button
          onClick={generate}
          disabled={loading}
          className="bg-violet-600 hover:bg-violet-700 text-snow"
        >
          {loading
            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Thinking...</>
            : <><Brain className="mr-2 h-4 w-4" /> Get Support</>}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 py-2">
      <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-5">
        <p className="text-white leading-relaxed text-sm whitespace-pre-wrap">{message}</p>
      </div>
      <Button
        variant="outline"
        onClick={() => { setDone(false); setContext('') }}
        className="border-white/20 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10"
      >
        <RefreshCw className="mr-2 h-3.5 w-3.5" /> Ask Again
      </Button>
    </div>
  )
}

const fallback = "Take a breath. You're doing better than you think. Hard moments pass — this one will too."

// ─── Goals view ───────────────────────────────────────────────────
type GoalCategory = 'fitness' | 'finance' | 'books' | 'general' | 'career'

interface Goal {
  id: string
  title: string
  category: GoalCategory
  target_date: string | null
}

const CATEGORY_DOT: Record<GoalCategory, string> = {
  fitness: 'bg-emerald-400',
  finance: 'bg-sky-400',
  books:   'bg-amber-400',
  general: 'bg-violet-400',
  career:  'bg-rose-400',
}

function GoalsView() {
  const { data: goals, loading, isOffline } = useCachedQuery<Goal[]>(
    'quick-reset:goals',
    (supabase, userId) => supabase
      .from('user_goals')
      .select('id, title, category, target_date')
      .eq('user_id', userId)
      .eq('is_completed', false)
      .order('target_date', { ascending: true, nullsFirst: false }),
    [],
    []
  )

  if (loading) {
    return <div className="flex justify-center py-14"><Loader2 className="h-5 w-5 animate-spin text-slate-500" /></div>
  }

  if (goals.length === 0 && isOffline) {
    return (
      <div className="text-center py-10 space-y-3">
        <Target className="h-8 w-8 text-amber-400/40 mx-auto" />
        <p className="text-slate-400 text-sm">Can&rsquo;t load — you&rsquo;re offline.</p>
      </div>
    )
  }

  if (goals.length === 0) {
    return (
      <div className="text-center py-10 space-y-3">
        <Target className="h-8 w-8 text-amber-400/40 mx-auto" />
        <p className="text-slate-400 text-sm">No active goals yet.</p>
        <p className="text-slate-500 text-xs">Add goals from the Goals page.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] text-amber-400/60 uppercase tracking-widest text-center">
        {goals.length} active goal{goals.length !== 1 ? 's' : ''}
      </p>
      <div className="space-y-1.5 max-h-[55vh] overflow-y-auto pr-1">
        {goals.map(goal => {
          const days = goal.target_date ? differenceInDays(parseISO(goal.target_date), new Date()) : null
          return (
            <div key={goal.id} className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-3">
              <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', CATEGORY_DOT[goal.category])} />
              <span className="flex-1 min-w-0 text-sm text-slate-200">{goal.title}</span>
              {days !== null && (
                <span className={cn(
                  'text-xs shrink-0 font-medium',
                  days < 0  ? 'text-red-400'   :
                  days === 0 ? 'text-amber-300' :
                  days <= 7  ? 'text-amber-400' :
                  days <= 30 ? 'text-slate-400' : 'text-slate-500',
                )}>
                  {days < 0 ? 'Overdue' : days === 0 ? 'Today' : `${days}d`}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Tasks view ──────────────────────────────────────────────────
function TasksView() {
  const { data: todos, loading, isOffline, setData: setTodos } = useCachedQuery<PlannerItem[]>(
    'quick-reset:planner',
    (supabase, userId) => openNowQuery(supabase, userId, todayStr()),
    [],
    []
  )

  async function complete(todo: PlannerItem) {
    setTodos(prev => prev.filter(t => t.id !== todo.id))
    const restore = () => setTodos(prev => (prev.some(t => t.id === todo.id) ? prev : [...prev, todo]))
    try {
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { restore(); return }
      await completeItem(supabase, user.id, todo, todo.period_start, todayStr())
    } catch (err) {
      console.error('Failed to complete planner item', err)
      restore()
    }
  }

  if (loading) {
    return <div className="flex justify-center py-14"><Loader2 className="h-5 w-5 animate-spin text-slate-500" /></div>
  }

  if (todos.length === 0 && isOffline) {
    return (
      <div className="text-center py-10 space-y-3">
        <CheckSquare className="h-8 w-8 text-sky-400/40 mx-auto" />
        <p className="text-slate-400 text-sm">Can&rsquo;t load — you&rsquo;re offline.</p>
      </div>
    )
  }

  if (todos.length === 0) {
    return (
      <div className="text-center py-10 space-y-3">
        <CheckSquare className="h-8 w-8 text-sky-400/40 mx-auto" />
        <p className="text-slate-400 text-sm">All caught up — no pending tasks.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] text-sky-400/60 uppercase tracking-widest text-center">
        {todos.length} pending task{todos.length !== 1 ? 's' : ''}
      </p>
      <div className="space-y-1.5 max-h-[55vh] overflow-y-auto pr-1">
        {todos.map(todo => {
          const overdue = todo.period_start < periodStart(todo.period_type, todayStr())
          return (
            <button
              key={todo.id}
              onClick={() => complete(todo)}
              className="group w-full flex items-center gap-3 rounded-xl bg-white/5 hover:bg-sky-500/10 px-3 py-3 text-left transition-colors"
            >
              <Circle className="h-4 w-4 shrink-0 text-slate-600 group-hover:text-sky-400 transition-colors" />
              <span className="flex-1 min-w-0 text-sm text-slate-200 group-hover:text-white transition-colors truncate">
                {todo.title}
              </span>
              {overdue && (
                <span className="text-xs shrink-0 font-medium text-red-400">Overdue</span>
              )}
            </button>
          )
        })}
      </div>
      <p className="text-[10px] text-slate-600 text-center">Tap a task to mark it done</p>
    </div>
  )
}

// ─── My Identity view ─────────────────────────────────────────────
function IdentityView() {
  const { data: identityRow, loading, isOffline } = useCachedQuery<{ pledge: string | null } | null>(
    'daily-practice:pledge',
    (supabase, userId) => supabase
      .from('daily_practice')
      .select('pledge')
      .eq('user_id', userId)
      .maybeSingle(),
    null,
    []
  )
  const pledge = identityRow?.pledge ?? null

  if (loading) {
    return <div className="flex justify-center py-14"><Loader2 className="h-5 w-5 animate-spin text-slate-500" /></div>
  }

  if (!pledge && isOffline) {
    return (
      <div className="text-center py-10 space-y-3">
        <ScrollText className="h-8 w-8 text-amber-400/40 mx-auto" />
        <p className="text-slate-400 text-sm">Can&rsquo;t load — you&rsquo;re offline.</p>
      </div>
    )
  }

  if (!pledge) {
    return (
      <div className="text-center py-10 space-y-3">
        <ScrollText className="h-8 w-8 text-amber-400/40 mx-auto" />
        <p className="text-slate-400 text-sm">No identity statement yet.</p>
        <p className="text-slate-500 text-xs">Write yours in Daily Practice on the dashboard.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 py-2">
      <p className="text-[11px] text-amber-400/60 uppercase tracking-widest text-center">Who you are &amp; who you&rsquo;re becoming</p>
      <div
        className="rounded-xl border-l-2 border-amber-500/40 bg-amber-500/5 px-4 py-4 text-sm text-slate-200 leading-relaxed max-h-[55vh] overflow-y-auto prose prose-invert prose-sm prose-p:my-1 prose-ul:my-1 prose-li:my-0"
        dangerouslySetInnerHTML={{ __html: pledge }}
      />
    </div>
  )
}

// ─── 5-4-3-2-1 Grounding exercise ────────────────────────────────

const GROUNDING_STEPS = [
  { count: 5, sense: 'SEE',   emoji: '👁',  color: 'text-sky-300',     ring: 'border-sky-500/30',    bg: 'bg-sky-500/10',    placeholder: 'e.g. the ceiling, my phone, a plant…' },
  { count: 4, sense: 'FEEL',  emoji: '🤚',  color: 'text-amber-300',   ring: 'border-amber-500/30',  bg: 'bg-amber-500/10',  placeholder: 'e.g. the chair, my breath, warmth…'    },
  { count: 3, sense: 'HEAR',  emoji: '👂',  color: 'text-emerald-300', ring: 'border-emerald-500/30',bg: 'bg-emerald-500/10',placeholder: 'e.g. traffic, birds, my heartbeat…'    },
  { count: 2, sense: 'SMELL', emoji: '👃',  color: 'text-violet-300',  ring: 'border-violet-500/30', bg: 'bg-violet-500/10', placeholder: 'e.g. coffee, fresh air…'                },
  { count: 1, sense: 'TASTE', emoji: '👅',  color: 'text-rose-300',    ring: 'border-rose-500/30',   bg: 'bg-rose-500/10',   placeholder: 'e.g. mint, water, nothing…'             },
] as const

function GroundingExercise() {
  const [stepIdx, setStepIdx] = useState(-1)
  const [answers, setAnswers] = useState<string[][]>(
    GROUNDING_STEPS.map(s => Array.from({ length: s.count }, () => ''))
  )

  const step   = stepIdx >= 0 && stepIdx < GROUNDING_STEPS.length ? GROUNDING_STEPS[stepIdx] : null
  const isLast = stepIdx === GROUNDING_STEPS.length - 1
  const isDone = stepIdx >= GROUNDING_STEPS.length

  function updateAnswer(itemIdx: number, value: string) {
    setAnswers(prev => prev.map((arr, si) =>
      si === stepIdx ? arr.map((v, i) => i === itemIdx ? value : v) : arr
    ))
  }

  function canAdvance() {
    if (stepIdx < 0) return true
    return answers[stepIdx].some(a => a.trim().length > 0)
  }

  function advance() { setStepIdx(i => i + 1) }

  function reset() {
    setStepIdx(-1)
    setAnswers(GROUNDING_STEPS.map(s => Array.from({ length: s.count }, () => '')))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, itemIdx: number) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    // Move to the next input in the same step, or advance if last
    const next = document.querySelector<HTMLInputElement>(`[data-step="${stepIdx}"] [data-item="${itemIdx + 1}"]`)
    if (next) next.focus()
    else if (canAdvance()) advance()
  }

  // ── Intro ────────────────────────────────────────────────────────
  if (stepIdx === -1) return (
    <div className="flex flex-col items-center gap-5 py-2 text-center">
      <div className="space-y-1.5">
        <p className="text-white font-semibold text-base">5-4-3-2-1 Grounding</p>
        <p className="text-slate-400 text-sm leading-relaxed px-2">
          Anchor to the present by noticing your surroundings through each sense.
        </p>
      </div>
      <div className="flex flex-col gap-1.5 w-full">
        {GROUNDING_STEPS.map(s => (
          <div key={s.sense} className={cn('flex items-center gap-3 rounded-xl px-4 py-2.5', s.bg)}>
            <span className="text-lg w-7 text-center">{s.emoji}</span>
            <span className={cn('text-sm font-medium', s.color)}>
              <span className="font-bold">{s.count}</span> things you can <span className="font-bold">{s.sense.toLowerCase()}</span>
            </span>
          </div>
        ))}
      </div>
      <Button onClick={advance} className="bg-teal-600 hover:bg-teal-700 text-snow px-10">
        Begin
      </Button>
    </div>
  )

  // ── Completion ───────────────────────────────────────────────────
  if (isDone) return (
    <div className="flex flex-col items-center gap-5 py-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-500/20 border-2 border-teal-500/30">
        <span className="text-3xl">🌿</span>
      </div>
      <div className="space-y-1.5">
        <p className="text-white font-semibold text-base">You&rsquo;re grounded</p>
        <p className="text-slate-400 text-sm px-3 leading-relaxed">
          You just brought yourself into the present moment. Take one more slow breath and carry this calm with you.
        </p>
      </div>
      <Button variant="outline" onClick={reset}
        className="border-white/20 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10">
        <RefreshCw className="mr-2 h-3.5 w-3.5" /> Do it again
      </Button>
    </div>
  )

  // ── Active step ──────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      {/* Progress pills */}
      <div className="flex justify-center gap-1.5">
        {GROUNDING_STEPS.map((s, i) => (
          <div key={s.sense} className={cn(
            'h-1.5 rounded-full transition-all duration-300',
            i < stepIdx   ? 'bg-teal-400 w-4' :
            i === stepIdx ? 'bg-teal-400 w-6' :
                            'bg-white/15 w-4',
          )} />
        ))}
      </div>

      {/* Sense header */}
      <div className={cn('rounded-2xl border px-5 py-4 text-center space-y-1', step!.ring, step!.bg)}>
        <div className="flex items-center justify-center gap-3">
          <span className="text-3xl">{step!.emoji}</span>
          <span className={cn('text-5xl font-bold tabular-nums leading-none', step!.color)}>{step!.count}</span>
        </div>
        <p className={cn('text-sm font-bold uppercase tracking-widest mt-1', step!.color)}>
          things you can {step!.sense.toLowerCase()}
        </p>
      </div>

      {/* Inputs — key forces remount on step change so autoFocus works */}
      <div key={stepIdx} data-step={stepIdx} className="space-y-2">
        {answers[stepIdx].map((val, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="text-xs text-slate-600 w-4 shrink-0 text-right tabular-nums">{i + 1}</span>
            <input
              data-item={i}
              autoFocus={i === 0}
              value={val}
              onChange={e => updateAnswer(i, e.target.value)}
              onKeyDown={e => handleKeyDown(e, i)}
              placeholder={i === 0 ? step!.placeholder : ''}
              className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-700 focus:outline-none focus:border-teal-500/50 transition-colors"
            />
          </div>
        ))}
      </div>

      <Button
        onClick={advance}
        disabled={!canAdvance()}
        className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-snow"
      >
        {isLast ? '✓ Complete' : `Next →`}
      </Button>
    </div>
  )
}

// ─── Mode config ──────────────────────────────────────────────────
const MODES = [
  {
    id:     'breathing'    as Mode,
    label:  'Breathe',
    icon:   Wind,
    accent: 'text-blue-400',
    border: 'border-blue-500/20',
    bg:     'bg-blue-500/8',
    hover:  'hover:bg-blue-500/15',
    desc:   'Box breathing · 4-4-6-4s',
  },
  {
    id:     'grounding'    as Mode,
    label:  'Ground',
    icon:   Leaf,
    accent: 'text-teal-400',
    border: 'border-teal-500/20',
    bg:     'bg-teal-500/8',
    hover:  'hover:bg-teal-500/15',
    desc:   '5-4-3-2-1 senses technique',
  },
  {
    id:     'affirmations' as Mode,
    label:  'Affirm',
    icon:   Sparkles,
    accent: 'text-violet-400',
    border: 'border-violet-500/20',
    bg:     'bg-violet-500/8',
    hover:  'hover:bg-violet-500/15',
    desc:   'Your personal affirmations',
  },
  {
    id:     'ai'           as Mode,
    label:  'AI Support',
    icon:   Brain,
    accent: 'text-emerald-400',
    border: 'border-emerald-500/20',
    bg:     'bg-emerald-500/8',
    hover:  'hover:bg-emerald-500/15',
    desc:   'Personalized reset message',
  },
  {
    id:     'goals'        as Mode,
    label:  'Goals',
    icon:   Target,
    accent: 'text-amber-400',
    border: 'border-amber-500/20',
    bg:     'bg-amber-500/8',
    hover:  'hover:bg-amber-500/15',
    desc:   'All your active goals',
  },
  {
    id:     'tasks'        as Mode,
    label:  'Tasks',
    icon:   CheckSquare,
    accent: 'text-sky-400',
    border: 'border-sky-500/20',
    bg:     'bg-sky-500/8',
    hover:  'hover:bg-sky-500/15',
    desc:   'Pending tasks — tap to complete',
  },
  {
    id:     'identity'     as Mode,
    label:  'My Identity',
    icon:   ScrollText,
    accent: 'text-amber-400',
    border: 'border-amber-500/20',
    bg:     'bg-amber-500/8',
    hover:  'hover:bg-amber-500/15',
    desc:   'Who you are & who you\'re becoming',
  },
]

// ─── Main export ──────────────────────────────────────────────────
export default function QuickReset({ floatingOnly = false }: { floatingOnly?: boolean }) {
  const [open, setOpen]   = useState(false)
  const [mode, setMode]   = useState<Mode>('menu')
  const [pinging, setPinging] = useState(true)
  const fab = useDraggableFab('quickreset_fab_pos')

  useEffect(() => {
    const t = setTimeout(() => setPinging(false), 3000)
    return () => clearTimeout(t)
  }, [])

  function close() { setOpen(false); setMode('menu') }

  const current = MODES.find(m => m.id === mode)

  if (!open) {
    return (
      <>
        {/* ── Featured card with 3 direct-access mode buttons ── */}
        {!floatingOnly && <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-800/70 to-slate-900/90 p-4 shadow-lg">
          <div className="flex items-center gap-3 mb-3.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/30 via-violet-500/20 to-emerald-500/20 border border-white/10">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white tracking-tight">Quick Reset</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Take a moment to reset right now</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {MODES.map((m, i) => {
              const Icon = m.icon
              return (
                <button
                  key={m.id}
                  onClick={() => { setMode(m.id); setOpen(true) }}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-xl border py-3.5 px-2 transition-all active:scale-95',
                    i === MODES.length - 1 && MODES.length % 3 === 1 ? 'col-span-3' : '',
                    m.border, m.bg, m.hover,
                  )}
                >
                  <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg bg-white/5')}>
                    <Icon className={cn('h-4 w-4', m.accent)} />
                  </div>
                  <span className={cn('text-[11px] font-semibold', m.accent)}>{m.label}</span>
                  <span className="text-[10px] text-slate-600 text-center leading-tight hidden sm:block">{m.desc}</span>
                </button>
              )
            })}
          </div>
        </div>}

        {/* ── Floating action button — stays visible while scrolling ── */}
        {/* Only rendered for the global floatingOnly instance (see layout.tsx) — the
            dashboard's inline card instance would otherwise mount a second, independent
            FAB stacked exactly on top of the first. */}
        {floatingOnly && (
          <div
            ref={fab.ref}
            style={fab.style}
            onPointerDown={fab.handlers.onPointerDown}
            className="fixed bottom-[4.75rem] right-4 z-50 cursor-grab active:cursor-grabbing sm:bottom-6 sm:right-6"
          >
            {/* Pulse ring — fades after 3 s */}
            {pinging && <span className="absolute inset-0 rounded-full animate-ping bg-violet-500/30 pointer-events-none" />}
            <button
              onClick={() => { if (!fab.wasDragged()) setOpen(true) }}
              title="Quick Reset"
              className="relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-violet-600 shadow-lg shadow-violet-500/40 hover:shadow-violet-500/60 hover:scale-105 active:scale-95 transition-all"
            >
              <Zap className="h-5 w-5 text-white" />
            </button>
          </div>
        )}
      </>
    )
  }

  return (
    <div
      className="sheet-in fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) close() }}
    >
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-5 space-y-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {mode !== 'menu' && (
              <button
                onClick={() => setMode('menu')}
                className="text-slate-500 hover:text-white transition-colors p-1 -ml-1 rounded"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <p className="text-sm font-semibold text-white">
              {mode === 'menu' ? 'Quick Reset' : current?.label}
            </p>
          </div>
          <button onClick={close} className="text-slate-500 hover:text-white transition-colors p-1 rounded">
            <X className="h-4 w-4" />
          </button>
        </div>

        {mode === 'menu' && (
          <>
            <p className="text-xs text-slate-500 -mt-2">Choose what you need right now</p>
            <div className="grid gap-2.5">
              {MODES.map(m => {
                const Icon = m.icon
                return (
                  <button
                    key={m.id}
                    onClick={() => setMode(m.id)}
                    className={cn(
                      'flex items-center gap-4 rounded-xl border p-4 text-left transition-all',
                      m.border, m.bg, m.hover,
                    )}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/8">
                      <Icon className={cn('h-5 w-5', m.accent)} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{m.label}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{m.desc}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </>
        )}

        {mode === 'breathing'    && <BreathingExercise />}
        {mode === 'affirmations' && <AffirmationsFlash />}
        {mode === 'ai'           && <AIResetMessage />}
        {mode === 'goals'        && <GoalsView />}
        {mode === 'tasks'        && <TasksView />}
        {mode === 'identity'     && <IdentityView />}
        {mode === 'grounding'    && <GroundingExercise />}
      </div>
    </div>
  )
}
