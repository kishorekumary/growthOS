'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Wind, Sparkles, Brain, X, ChevronLeft, ChevronRight, Loader2, RefreshCw, Zap } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Mode = 'menu' | 'breathing' | 'affirmations' | 'ai'

// ─── Box breathing phases ─────────────────────────────────────────
const PHASES = [
  { label: 'Inhale',  duration: 4000, expand: true  },
  { label: 'Hold',    duration: 4000, expand: true  },
  { label: 'Exhale',  duration: 4000, expand: false },
  { label: 'Hold',    duration: 4000, expand: false },
] as const

// ─── Breathing exercise ───────────────────────────────────────────
function BreathingExercise() {
  const [phase, setPhase]   = useState(0)
  const [cycles, setCycles] = useState(0)
  const [running, setRunning] = useState(false)
  const ctxRef = useRef<AudioContext | null>(null)

  const tone = useCallback((freq: number) => {
    const ctx = ctxRef.current
    if (!ctx) return
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.1)
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.5)
  }, [])

  useEffect(() => {
    if (!running) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    tone(528)
    let current = 0
    setPhase(0)

    function advance() {
      current = (current + 1) % PHASES.length
      setPhase(current)
      if (current === 0) setCycles(c => c + 1)
      tone(current === 0 ? 528 : current === 2 ? 396 : 440)
      timer = setTimeout(advance, PHASES[current].duration)
    }

    let timer = setTimeout(advance, PHASES[0].duration)
    return () => {
      clearTimeout(timer)
      ctxRef.current?.close()
    }
  }, [running, tone])

  const current  = PHASES[phase]
  const expanded = current.expand

  if (!running) {
    return (
      <div className="flex flex-col items-center gap-6 py-6">
        <div className="text-center space-y-1.5">
          <p className="text-white font-semibold">Box Breathing</p>
          <p className="text-slate-400 text-sm">Inhale · Hold · Exhale · Hold — 4 seconds each</p>
        </div>

        <div className="relative flex items-center justify-center w-44 h-44">
          <div className="w-32 h-32 rounded-full bg-blue-500/15 border-2 border-blue-400/30" />
          <div className="absolute w-16 h-16 rounded-full bg-blue-400/25 border border-blue-300/40" />
        </div>

        <Button onClick={() => { setCycles(0); setRunning(true) }} className="bg-blue-600 hover:bg-blue-700 text-white px-8">
          <Wind className="mr-2 h-4 w-4" /> Begin
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <div className="text-center">
        <p className="text-2xl font-light text-white tracking-widest">{current.label}</p>
        <p className="text-slate-600 text-xs mt-1">{cycles} cycle{cycles !== 1 ? 's' : ''} complete</p>
      </div>

      <div className="relative flex items-center justify-center w-48 h-48">
        {/* outer pulse ring */}
        <div className={cn(
          'absolute rounded-full border-2 transition-all ease-in-out',
          expanded
            ? 'w-44 h-44 border-blue-400/50 bg-blue-500/10'
            : 'w-20 h-20 border-blue-400/20 bg-blue-500/5',
          phase === 0 || phase === 2 ? 'duration-[4000ms]' : 'duration-150',
        )} />
        {/* inner circle */}
        <div className={cn(
          'absolute rounded-full transition-all ease-in-out',
          expanded ? 'w-28 h-28 bg-blue-500/25' : 'w-10 h-10 bg-blue-500/15',
          phase === 0 || phase === 2 ? 'duration-[4000ms]' : 'duration-150',
        )} />
        <p className="relative z-10 text-blue-200 text-sm font-medium">{current.label}</p>
      </div>

      <Button
        variant="outline"
        onClick={() => setRunning(false)}
        className="border-white/20 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10"
      >
        Stop
      </Button>
    </div>
  )
}

// ─── Affirmations flash ───────────────────────────────────────────
function AffirmationsFlash() {
  const [affirmations, setAffirmations] = useState<string[]>([])
  const [index, setIndex]   = useState(0)
  const [loading, setLoading] = useState(true)
  const [fading, setFading]   = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createSupabaseBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { setLoading(false); return }
      const { data } = await supabase
        .from('daily_practice')
        .select('affirmations')
        .eq('user_id', session.user.id)
        .maybeSingle()
      setAffirmations((data?.affirmations as string[] | null) ?? [])
      setLoading(false)
    }
    load()
  }, [])

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

  if (affirmations.length === 0) {
    return (
      <div className="text-center py-10 space-y-3">
        <Sparkles className="h-8 w-8 text-violet-400/40 mx-auto" />
        <p className="text-slate-400 text-sm">No affirmations saved yet.</p>
        <p className="text-slate-500 text-xs">Add some in Daily Practice on the dashboard.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <p className="text-[11px] text-violet-400/60 uppercase tracking-widest">
        {index + 1} of {affirmations.length}
      </p>

      <div className={cn(
        'min-h-[100px] flex items-center justify-center px-4 transition-opacity duration-[250ms]',
        fading ? 'opacity-0' : 'opacity-100',
      )}>
        <blockquote className="text-center text-xl font-light text-white leading-relaxed italic">
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
          className="bg-violet-600 hover:bg-violet-700 text-white"
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
    desc:   'Box breathing · 4 seconds each',
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
]

// ─── Main export ──────────────────────────────────────────────────
export default function QuickReset() {
  const [open, setOpen]   = useState(false)
  const [mode, setMode]   = useState<Mode>('menu')
  const [pinging, setPinging] = useState(true)

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
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-800/70 to-slate-900/90 p-4 shadow-lg">
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
            {MODES.map(m => {
              const Icon = m.icon
              return (
                <button
                  key={m.id}
                  onClick={() => { setMode(m.id); setOpen(true) }}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-xl border py-3.5 px-2 transition-all active:scale-95',
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
        </div>

        {/* ── Floating action button — stays visible while scrolling ── */}
        <div className="fixed bottom-[4.75rem] right-4 z-40 sm:bottom-6 sm:right-6">
          {/* Pulse ring — fades after 3 s */}
          {pinging && <span className="absolute inset-0 rounded-full animate-ping bg-violet-500/30 pointer-events-none" />}
          <button
            onClick={() => setOpen(true)}
            title="Quick Reset"
            className="relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-violet-600 shadow-lg shadow-violet-500/40 hover:shadow-violet-500/60 hover:scale-105 active:scale-95 transition-all"
          >
            <Zap className="h-5 w-5 text-white" />
          </button>
        </div>
      </>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
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
      </div>
    </div>
  )
}
