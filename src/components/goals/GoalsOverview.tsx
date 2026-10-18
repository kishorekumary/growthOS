'use client'

import { Flag, Trophy } from 'lucide-react'
import { goalsOverview, type GoalLike } from '@/lib/goalProgress'
import { differenceInCalendarDays, parseISO, startOfDay } from 'date-fns'
import CountUp from '@/components/ui/count-up'

// Top of the Goals page: achieved this year as a ring, what's in flight,
// what's due soon or late, and the nearest deadline.
export default function GoalsOverview<T extends GoalLike>({ goals }: { goals: readonly T[] }) {
  const o = goalsOverview(goals)
  const total = o.active + o.achievedThisYear
  const share = total ? o.achievedThisYear / total : 0
  const r = 30, circ = 2 * Math.PI * r
  const nextDays = o.next ? differenceInCalendarDays(parseISO(o.next.target_date!), startOfDay(new Date())) : null

  return (
    <div className="card-sheen relative overflow-hidden rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-500/15 via-violet-500/5 to-transparent p-5">
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-violet-500/25 blur-3xl" />

      <div className="relative flex items-center gap-5">
        <div className="relative h-20 w-20 shrink-0">
          <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
            <defs>
              <linearGradient id="goals-ring" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#c4b5fd" /><stop offset="100%" stopColor="#34d399" />
              </linearGradient>
            </defs>
            <circle cx="40" cy="40" r={r} fill="none" stroke="rgb(var(--c-white) / 0.08)" strokeWidth="7" />
            <circle cx="40" cy="40" r={r} fill="none" stroke="url(#goals-ring)" strokeWidth="7" strokeLinecap="round"
              strokeDasharray={circ} strokeDashoffset={circ * (1 - share)}
              className="transition-[stroke-dashoffset] duration-1000 ease-out" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <Trophy className="h-3.5 w-3.5 text-emerald-300" />
            <span className="text-lg font-bold leading-none text-white"><CountUp value={o.achievedThisYear} /></span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-300">{new Date().getFullYear()} so far</p>
          <p className="mt-0.5 text-sm text-slate-300">
            <span className="font-semibold text-white">{o.achievedThisYear}</span> achieved
            {' · '}<span className="font-semibold text-white">{o.active}</span> in progress
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {o.dueThisWeek > 0 && (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                {o.dueThisWeek} due this week
              </span>
            )}
            {o.overdue > 0 && (
              <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-semibold text-red-300">
                {o.overdue} overdue
              </span>
            )}
            {o.dueThisWeek === 0 && o.overdue === 0 && o.active > 0 && (
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                Nothing urgent 🌿
              </span>
            )}
          </div>
        </div>
      </div>

      {o.next && nextDays !== null && (
        <p className="relative mt-4 flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2 text-xs text-slate-400">
          <Flag className="h-3.5 w-3.5 shrink-0 text-violet-300" />
          <span className="min-w-0 flex-1 truncate">Next deadline: <span className="font-medium text-white">{o.next.title}</span></span>
          <span className="shrink-0 font-semibold text-violet-200">
            {nextDays === 0 ? 'today' : nextDays === 1 ? 'tomorrow' : `in ${nextDays} days`}
          </span>
        </p>
      )}
    </div>
  )
}
