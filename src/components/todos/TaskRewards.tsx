'use client'

import { useMemo, useState } from 'react'
import {
  isSameDay, parseISO, startOfWeek, endOfDay,
  addDays, subDays, format,
} from 'date-fns'
import { Leaf, Zap, Flame, Star, Crown, Sparkles, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Todo {
  id: string
  is_completed: boolean
  completed_at: string | null
  due_date: string | null
}

interface TierDef {
  label: string
  min: number
  next: number   // points needed to reach NEXT tier (for progress bar)
  color: string
  bg: string
  border: string
  bar: string
  Icon: React.ElementType
}

// ─── Tier tables ──────────────────────────────────────────────

// Daily: each task is worth 10-15 pts → typical productive day ≈ 50-150 pts
const DAILY_TIERS: TierDef[] = [
  { label: 'Seedling', min: 0,   next: 20,  color: 'text-slate-400',   bg: 'bg-slate-500/15',   border: 'border-slate-500/25',   bar: '#64748b', Icon: Leaf  },
  { label: 'Builder',  min: 20,  next: 60,  color: 'text-sky-400',     bg: 'bg-sky-500/15',     border: 'border-sky-500/25',     bar: '#38bdf8', Icon: Zap   },
  { label: 'Achiever', min: 60,  next: 120, color: 'text-amber-400',   bg: 'bg-amber-500/15',   border: 'border-amber-500/25',   bar: '#fbbf24', Icon: Flame },
  { label: 'Master',   min: 120, next: 200, color: 'text-violet-400',  bg: 'bg-violet-500/15',  border: 'border-violet-500/25',  bar: '#a78bfa', Icon: Star  },
  { label: 'Legend',   min: 200, next: 300, color: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/25', bar: '#34d399', Icon: Crown },
]

// Weekly: 7 days × ~80 pts/day potential
const WEEKLY_TIERS: TierDef[] = [
  { label: 'Seedling', min: 0,    next: 80,   color: 'text-slate-400',   bg: 'bg-slate-500/15',   border: 'border-slate-500/25',   bar: '#64748b', Icon: Leaf  },
  { label: 'Builder',  min: 80,   next: 300,  color: 'text-sky-400',     bg: 'bg-sky-500/15',     border: 'border-sky-500/25',     bar: '#38bdf8', Icon: Zap   },
  { label: 'Achiever', min: 300,  next: 600,  color: 'text-amber-400',   bg: 'bg-amber-500/15',   border: 'border-amber-500/25',   bar: '#fbbf24', Icon: Flame },
  { label: 'Master',   min: 600,  next: 1000, color: 'text-violet-400',  bg: 'bg-violet-500/15',  border: 'border-violet-500/25',  bar: '#a78bfa', Icon: Star  },
  { label: 'Legend',   min: 1000, next: 1400, color: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/25', bar: '#34d399', Icon: Crown },
]

function getTier(pts: number, tiers: TierDef[]): TierDef {
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (pts >= tiers[i].min) return tiers[i]
  }
  return tiers[0]
}

function getProgress(pts: number, tiers: TierDef[]): number {
  const tier = getTier(pts, tiers)
  if (pts >= tiers[tiers.length - 1].min) return 100
  return Math.min(100, Math.round(((pts - tier.min) / (tier.next - tier.min)) * 100))
}

// Points for a single completed todo
function taskPoints(todo: Todo): number {
  let pts = 10
  if (todo.due_date && todo.completed_at) {
    const completedDate = todo.completed_at.slice(0, 10)  // YYYY-MM-DD
    if (completedDate <= todo.due_date) pts += 5           // on-time bonus
  }
  return pts
}

// ─── Score card sub-component ─────────────────────────────────

function ScoreCard({
  label,
  pts,
  count,
  tiers,
}: {
  label: string
  pts: number
  count: number
  tiers: TierDef[]
}) {
  const tier  = getTier(pts, tiers)
  const prog  = getProgress(pts, tiers)
  const Icon  = tier.Icon
  const isMax = pts >= tiers[tiers.length - 1].min

  return (
    <div className="rounded-xl border border-white/8 bg-white/3 p-3.5 space-y-2.5">
      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{label}</p>

      <div className="flex items-end gap-1.5">
        <span className="text-3xl font-extrabold text-white leading-none tabular-nums">{pts}</span>
        <span className="text-xs text-slate-500 mb-0.5">pts</span>
      </div>

      <div className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold border',
        tier.bg, tier.color, tier.border
      )}>
        <Icon className="h-3 w-3" />
        {tier.label}
      </div>

      {/* Progress bar to next tier */}
      <div className="space-y-1">
        <div className="h-1.5 w-full rounded-full bg-white/8 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${prog}%`, background: `linear-gradient(90deg, ${tier.bar}99, ${tier.bar})` }}
          />
        </div>
        <p className="text-[10px] text-slate-600">
          {count} task{count !== 1 ? 's' : ''} completed
          {!isMax && ` · ${tiers[tiers.findIndex(t => t.min === tier.min) + 1]?.min - pts} pts to next tier`}
        </p>
      </div>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────

export default function TaskRewards({ todos }: { todos: Todo[] }) {
  const [collapsed, setCollapsed] = useState(false)
  const today    = new Date()
  const weekStart = startOfWeek(today, { weekStartsOn: 1 })  // Monday

  const stats = useMemo(() => {
    const done = todos.filter(t => t.is_completed && t.completed_at)

    // Today
    const todayDone = done.filter(t => isSameDay(parseISO(t.completed_at!), today))
    const todayPts  = todayDone.reduce((s, t) => s + taskPoints(t), 0)

    // This week (Mon → today)
    const weekDone = done.filter(t => {
      const d = parseISO(t.completed_at!)
      return d >= weekStart && d <= endOfDay(today)
    })
    const weekPts = weekDone.reduce((s, t) => s + taskPoints(t), 0)

    // Week grid: 7 cells Mon-Sun
    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const day   = addDays(weekStart, i)
      const count = done.filter(t => isSameDay(parseISO(t.completed_at!), day)).length
      return { day, count, isToday: isSameDay(day, today), isFuture: day > today }
    })

    // Streak: consecutive days with ≥1 completion ending today (or yesterday if nothing done yet today)
    let streak   = 0
    let checkDay = today
    if (!done.some(t => isSameDay(parseISO(t.completed_at!), checkDay))) {
      checkDay = subDays(checkDay, 1)
    }
    while (done.some(t => isSameDay(parseISO(t.completed_at!), checkDay))) {
      streak++
      checkDay = subDays(checkDay, 1)
      if (streak > 365) break
    }

    return { todayPts, weekPts, todayCount: todayDone.length, weekCount: weekDone.length, weekDays, streak }
  }, [todos])   // eslint-disable-line react-hooks/exhaustive-deps

  const { todayPts, weekPts, todayCount, weekCount, weekDays, streak } = stats

  return (
    <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.04] p-4 space-y-3">
      {/* Header */}
      <button
        type="button"
        onClick={() => setCollapsed(v => !v)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-400" />
          <span className="text-sm font-semibold text-white">Rewards</span>
          {streak > 1 && (
            <span className="flex items-center gap-0.5 text-xs font-bold text-orange-400">
              🔥 {streak}d streak
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">
            {todayPts} pts today
          </span>
          {collapsed
            ? <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
            : <ChevronUp   className="h-3.5 w-3.5 text-slate-500" />
          }
        </div>
      </button>

      {!collapsed && (
        <>
          {/* Score cards */}
          <div className="grid grid-cols-2 gap-3">
            <ScoreCard label="Today"     pts={todayPts} count={todayCount} tiers={DAILY_TIERS}  />
            <ScoreCard label="This Week" pts={weekPts}  count={weekCount}  tiers={WEEKLY_TIERS} />
          </div>

          {/* Week activity grid */}
          <div className="rounded-xl border border-white/8 bg-white/3 p-3 space-y-2">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Weekly Activity</p>
            <div className="flex items-end justify-between gap-1">
              {weekDays.map(({ day, count, isToday, isFuture }) => {
                const heightPct = isFuture ? 0 : Math.min(100, count * 16 + (count > 0 ? 10 : 0))
                const label = format(day, 'EEE').slice(0, 1)
                return (
                  <div key={day.toISOString()} className="flex flex-col items-center gap-1 flex-1">
                    {/* Bar */}
                    <div className="relative flex items-end h-10 w-full justify-center">
                      {!isFuture && count > 0 && (
                        <div
                          className={cn(
                            'w-full max-w-[28px] rounded-t-md transition-all duration-500',
                            count < 3 ? 'bg-violet-500/40' :
                            count < 6 ? 'bg-amber-500/50' :
                            'bg-emerald-500/60'
                          )}
                          style={{ height: `${heightPct}%` }}
                        />
                      )}
                      {!isFuture && count === 0 && (
                        <div className="w-full max-w-[28px] h-[3px] rounded-full bg-white/8 self-end" />
                      )}
                    </div>
                    {/* Count */}
                    <span className={cn(
                      'text-[10px] font-bold tabular-nums',
                      isFuture   ? 'text-slate-700' :
                      count === 0 ? 'text-slate-700' :
                      isToday    ? 'text-violet-400' :
                      count < 3  ? 'text-slate-400' :
                      count < 6  ? 'text-amber-400' :
                                   'text-emerald-400'
                    )}>
                      {isFuture ? '' : count > 0 ? count : '·'}
                    </span>
                    {/* Day label */}
                    <span className={cn(
                      'text-[10px] font-medium',
                      isToday ? 'text-violet-400' : 'text-slate-600'
                    )}>
                      {label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Scoring legend */}
          <div className="flex items-center gap-4 text-[10px] text-slate-600 pt-0.5">
            <span>10 pts / task</span>
            <span className="text-amber-600">+5 pts on-time bonus</span>
            <span className="ml-auto">5 tiers total</span>
          </div>
        </>
      )}
    </div>
  )
}
