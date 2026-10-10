'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Check, Loader2, ArrowRight } from 'lucide-react'
import { useWorkbook } from '@/hooks/useWorkbook'
import { EXERCISES, PROGRAM, THEMES, lastDone, type Exercise } from '@/lib/workbook'
import ExerciseRunner from './ExerciseRunner'
import { cn } from '@/lib/utils'

const CADENCE_LABEL = { once: null, weekly: 'Weekly', monthly: 'Monthly' } as const

// All exercises grouped by theme, with program progress and what's due today.
export default function WorkbookApp() {
  const { loading, sessions, status, today, markDone } = useWorkbook()
  const [active, setActive] = useState<string | null>(null)
  const last = useMemo(() => lastDone(sessions), [sessions])
  const dueSlugs = new Set(status.due.map(e => e.slug))

  if (loading && sessions.length === 0) {
    return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-slate-500" /></div>
  }

  const pct = Math.round((status.programDone / PROGRAM.length) * 100)

  function row(e: Exercise) {
    const done = last.get(e.slug)
    const due  = dueSlugs.has(e.slug)
    const open = active === e.slug
    return (
      <div key={e.slug} className={cn('rounded-xl border bg-white/3 px-4 py-3', due ? 'border-violet-500/40' : 'border-white/8')}>
        {open ? (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-white">{e.title}</p>
            <ExerciseRunner
              exercise={e}
              date={today}
              onClose={() => setActive(null)}
              onSaved={() => { markDone(e.slug); setActive(null) }}
            />
          </div>
        ) : (
          <button type="button" onClick={() => setActive(e.slug)} className="flex w-full items-center justify-between gap-3 text-left">
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-sm font-medium text-white">
                {done && <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />}
                {e.title}
              </span>
              <span className="block text-[11px] text-slate-500">
                {[CADENCE_LABEL[e.cadence], `${e.questions.length} questions`, done && `last done ${done}`]
                  .filter(Boolean).join(' · ')}
              </span>
            </span>
            <span className={cn('shrink-0 text-xs font-semibold', due ? 'text-violet-300' : 'text-slate-500')}>
              {due ? 'Due today' : done ? 'Redo' : 'Start'}
            </span>
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/8 bg-white/3 p-5 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-white">Program</span>
          <span className="text-slate-400">{status.programDone} of {PROGRAM.length}</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/10">
          <div className="h-1.5 rounded-full bg-violet-500" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-slate-500">
          {status.next
            ? status.programDoneToday
              ? `Today's exercise is done. Tomorrow: ${status.next.title}.`
              : `Today: ${status.next.title}. One new exercise a day; your reminders will nudge you.`
            : 'Program complete. Redo any exercise whenever it is useful.'}
          {' '}The reviews repeat weekly (from Sunday) and monthly. The Daily Review is part of your{' '}
          <Link href="/dashboard#power" className="text-slate-400 underline">evening power questions</Link>.
        </p>
      </div>

      {THEMES.map(theme => {
        const items = EXERCISES.filter(e => e.theme === theme)
        if (!items.length) return null
        return (
          <section key={theme} className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{theme}</h2>
            {items.map(row)}
          </section>
        )
      })}

      <Link href="/personality/journal" className="flex items-center justify-center gap-1 text-xs text-slate-500 hover:text-white">
        Your answers are saved in the Journal <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  )
}
