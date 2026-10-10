'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Sunrise, Moon, Check, Loader2, ChevronLeft, ArrowRight, Flame } from 'lucide-react'
import { useCachedQuery } from '@/hooks/useCachedQuery'
import { useReward } from '@/contexts/RewardContext'
import { todayStr, yesterdayStr } from '@/lib/habitStreak'
import {
  MORNING_QUESTIONS, MORNING_FOLLOW_UP, EVENING_QUESTIONS, POWER_TAG, POWER_POINTS,
  defaultKind, eveningHabitQuestion, powerStreak, type PowerKind,
} from '@/lib/powerQuestions'
import { cn } from '@/lib/utils'

interface Session { entry_date: string; tags: string[] }
interface Habit   { id: string; habit_name: string; frequency: string; is_global: boolean }
interface Log     { habit_id: string; status: string }
interface IdMark  { habit_id: string }

const draftKey = (date: string, kind: PowerKind) => `power-draft:${date}:${kind}`

// Morning/evening power-questions ritual (see src/lib/powerQuestions.ts).
// One question at a time; answers are drafted to localStorage so an
// interrupted session resumes, and saved to the journal on finish.
export default function PowerQuestions() {
  const today     = todayStr()
  const yesterday = yesterdayStr()
  const since = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 60)
    return d.toISOString().slice(0, 10)
  }, [])

  const { data: sessions, loading, setData: setSessions } = useCachedQuery<Session[]>(
    'power:sessions',
    (supabase, userId) => supabase
      .from('journal_entries').select('entry_date, tags')
      .eq('user_id', userId).gte('entry_date', since)
      .overlaps('tags', [POWER_TAG.morning, POWER_TAG.evening]),
    [],
  )
  const { data: habits } = useCachedQuery<Habit[]>(
    'pq:habits',
    (supabase, userId) => supabase
      .from('personality_habits').select('id, habit_name, frequency, is_global')
      .or(`user_id.eq.${userId},is_global.eq.true`),
    [],
  )
  const { data: hidden } = useCachedQuery<IdMark[]>(
    'hidden-global-habits',
    (supabase, userId) => supabase.from('user_hidden_habits').select('habit_id').eq('user_id', userId),
    [],
  )
  const { data: todayLogs } = useCachedQuery<Log[]>(
    `pq:logs:${today}`,
    (supabase, userId) => supabase.from('habit_logs').select('habit_id, status')
      .eq('user_id', userId).eq('log_date', today),
    [],
    [today],
  )
  const { celebrateMilestones } = useReward()

  const doneKinds = useMemo(() => {
    const kinds = new Set<PowerKind>()
    for (const s of sessions) {
      if (s.entry_date !== today) continue
      if (s.tags?.includes(POWER_TAG.morning)) kinds.add('morning')
      if (s.tags?.includes(POWER_TAG.evening)) kinds.add('evening')
    }
    return kinds
  }, [sessions, today])
  const streak = powerStreak(sessions.map(s => s.entry_date), today, yesterday)

  // Resolved after mount: the server render can't know the user's local hour.
  const [kind, setKind] = useState<PowerKind | null>(null)
  useEffect(() => { setKind(defaultKind(new Date().getHours())) }, [])

  const questions = useMemo(() => {
    if (kind !== 'evening') return MORNING_QUESTIONS
    const hiddenIds = new Set(hidden.map(h => h.habit_id))
    const daily  = habits.filter(h => h.frequency === 'daily' && !(h.is_global && hiddenIds.has(h.id)))
    const doneIds = new Set(todayLogs.filter(l => l.status === 'done').map(l => l.habit_id))
    const extra = eveningHabitQuestion(
      daily.filter(h => doneIds.has(h.id)).map(h => h.habit_name),
      daily.filter(h => !doneIds.has(h.id)).map(h => h.habit_name),
    )
    return extra ? [...EVENING_QUESTIONS, extra] : EVENING_QUESTIONS
  }, [kind, habits, hidden, todayLogs])

  const [active, setActive]   = useState(false)
  const [step, setStep]       = useState(0)
  const [answers, setAnswers] = useState<string[]>([])
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  function start() {
    if (!kind) return
    let saved: string[] = []
    try { saved = JSON.parse(localStorage.getItem(draftKey(today, kind)) ?? '[]') } catch {}
    setAnswers(questions.map((_, i) => saved[i] ?? ''))
    // Resume at the first unanswered question.
    const firstEmpty = questions.findIndex((_, i) => !(saved[i] ?? '').trim())
    setStep(firstEmpty === -1 ? questions.length - 1 : firstEmpty)
    setError(null)
    setActive(true)
  }

  function setAnswer(value: string) {
    const next = answers.map((a, i) => i === step ? value : a)
    setAnswers(next)
    try { if (kind) localStorage.setItem(draftKey(today, kind), JSON.stringify(next)) } catch {}
  }

  async function finish() {
    if (!kind || saving) return
    if (!answers.some(a => a.trim())) { setError('Answer at least one question'); return }
    setSaving(true)
    setError(null)
    const res = await fetch('/api/journal/power-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: today, kind, qa: questions.map((q, i) => ({ question: q, answer: answers[i] ?? '' })) }),
    })
    if (res.ok) {
      const { points } = await res.json() as { points: number }
      try { localStorage.removeItem(draftKey(today, kind)) } catch {}
      setSessions(prev => [...prev, { entry_date: today, tags: [POWER_TAG[kind]] }])
      setActive(false)
      if (points > 0) {
        celebrateMilestones([{
          label: kind === 'morning' ? 'Morning power questions done. Go win the day.' : 'Evening power questions done.',
          points,
        }])
      }
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Could not save your answers')
    }
    setSaving(false)
  }

  if (!kind || (loading && sessions.length === 0)) return null

  const isLast = step === questions.length - 1
  const Icon   = kind === 'morning' ? Sunrise : Moon
  const accent = kind === 'morning' ? 'text-amber-300' : 'text-indigo-300'

  return (
    <div id="power" className="rounded-2xl border border-white/8 bg-white/3 p-5 space-y-4">
      {/* Header: title, streak, morning/evening switch */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className={cn('h-4 w-4 shrink-0', accent)} />
          <span className="text-sm font-semibold text-white">Power Questions</span>
          {streak > 0 && (
            <span className="flex items-center gap-0.5 text-[11px] text-orange-400">
              <Flame className="h-3 w-3" />{streak}
            </span>
          )}
        </div>
        {!active && (
          <div className="flex rounded-lg border border-white/10 p-0.5 text-[11px]">
            {(['morning', 'evening'] as const).map(k => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={cn(
                  'flex items-center gap-1 rounded-md px-2 py-1 capitalize transition-colors',
                  kind === k ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300',
                )}
              >
                {doneKinds.has(k) && <Check className="h-3 w-3 text-emerald-400" />}
                {k}
              </button>
            ))}
          </div>
        )}
      </div>

      {active ? (
        <div className="space-y-3">
          {/* Progress */}
          <div className="flex gap-1">
            {questions.map((_, i) => (
              <span key={i} className={cn(
                'h-1 flex-1 rounded-full',
                i < step ? 'bg-emerald-400/60' : i === step ? (kind === 'morning' ? 'bg-amber-400' : 'bg-indigo-400') : 'bg-white/10',
              )} />
            ))}
          </div>

          <div>
            <p className="text-[11px] text-slate-500">{step + 1} of {questions.length}</p>
            <p className="text-base font-medium text-white leading-snug">{questions[step]}</p>
            {kind === 'morning' && <p className="mt-1 text-xs text-slate-500">{MORNING_FOLLOW_UP}</p>}
          </div>

          <textarea
            key={`${kind}-${step}`}
            autoFocus
            value={answers[step] ?? ''}
            onChange={e => setAnswer(e.target.value)}
            rows={3}
            placeholder="Take a breath. Answer it, then feel it."
            className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500/60"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => step === 0 ? setActive(false) : setStep(step - 1)}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-white"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> {step === 0 ? 'Later' : 'Back'}
            </button>
            <button
              type="button"
              onClick={() => isLast ? finish() : setStep(step + 1)}
              disabled={saving}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white transition-all disabled:opacity-50',
                kind === 'morning' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700',
              )}
            >
              {saving && <Loader2 className="h-3 w-3 animate-spin" />}
              {isLast ? `Finish · +${POWER_POINTS}` : (answers[step] ?? '').trim() ? 'Next' : 'Skip'}
            </button>
          </div>
        </div>
      ) : doneKinds.has(kind) ? (
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-sm text-emerald-300/90">
            <Check className="h-4 w-4" />
            {kind === 'morning' ? 'Morning questions done.' : 'Evening questions done.'}
          </p>
          <Link href="/journal" className="flex items-center gap-1 text-xs text-slate-500 hover:text-white shrink-0">
            Journal <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-300 leading-relaxed">
            {kind === 'morning'
              ? 'The quality of your life is the quality of your questions. Seven quick ones to set your focus for the day.'
              : 'Close the day: what you gave, what you learned, where you fell short of your values, and the one action that matters tomorrow.'}
          </p>
          <button
            type="button"
            onClick={start}
            className={cn(
              'w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition-all active:scale-[0.98]',
              kind === 'morning' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700',
            )}
          >
            Start {kind} questions · 2 min
          </button>
          <p className="text-[10px] text-slate-600">Inspired by Tony Robbins, <i>Awaken the Giant Within</i></p>
        </div>
      )}
    </div>
  )
}
