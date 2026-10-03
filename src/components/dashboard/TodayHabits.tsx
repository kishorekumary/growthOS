'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Check, Crown, Flame, Loader2, ArrowRight, Trophy, Sparkles, Gift, Lock, Snowflake } from 'lucide-react'
import { useCachedQuery } from '@/hooks/useCachedQuery'
import { useInFlightIds } from '@/hooks/useInFlightIds'
import { useHabitLeverage, leverageLine } from '@/hooks/useHabitLeverage'
import { useHabitCelebration } from '@/hooks/useHabitCelebration'
import { useReward } from '@/contexts/RewardContext'
import { completeHabit } from '@/lib/completeHabit'
import { localDateStr, todayStr, yesterdayStr } from '@/lib/habitStreak'
import { HABIT_CATEGORY_META, type HabitCategory } from '@/lib/habitCategories'
import { prevDate } from '@/lib/dailyChest'
import { cn } from '@/lib/utils'

interface Habit {
  id:             string
  habit_name:     string
  category:       HabitCategory
  streak_count:   number
  longest_streak: number
  last_done_at:   string | null
  is_keystone:    boolean
  is_global:      boolean
}
interface HabitLog  { habit_id: string; status: string }
interface IdMark    { habit_id: string }
interface Rewards   { current_perfect_streak: number; last_perfect_date: string | null }
interface Freezes   { streak_freezes: number }
interface ChestClaim { claim_date: string; chest_streak: number; points: number; freeze: boolean; label: string }

type Status = 'pending' | 'done' | 'skipped'

// The dashboard's first card: today's habits as one-tap rows, so opening the
// app is enough to act. Visibility and status rules mirror HabitTracker
// (own + global habits minus hidden ones; per-user keystones for globals).
// Undo and skip stay in the full tracker, which handles points reversal.
export default function TodayHabits() {
  const today     = todayStr()
  const yesterday = yesterdayStr()

  const { data: habits, loading: habitsLoading, setData: setHabits } = useCachedQuery<Habit[]>(
    'today:habits',
    (supabase, userId) => supabase
      .from('personality_habits')
      .select('id, habit_name, category, streak_count, longest_streak, last_done_at, is_keystone, is_global')
      .or(`user_id.eq.${userId},is_global.eq.true`)
      .order('created_at', { ascending: true }),
    [],
  )
  const { data: hidden } = useCachedQuery<IdMark[]>(
    'hidden-global-habits',
    (supabase, userId) => supabase.from('user_hidden_habits').select('habit_id').eq('user_id', userId),
    [],
  )
  const { data: globalKeystones } = useCachedQuery<IdMark[]>(
    'global-keystone-marks',
    (supabase, userId) => supabase.from('user_habit_keystones').select('habit_id').eq('user_id', userId),
    [],
  )
  const { data: logs, loading: logsLoading, setData: setLogs } = useCachedQuery<HabitLog[]>(
    `today:logs:${today}`,
    (supabase, userId) => supabase
      .from('habit_logs')
      .select('habit_id, status')
      .eq('user_id', userId)
      .eq('log_date', today),
    [],
    [today],
  )
  const { data: rewards, refetch: refetchRewards } = useCachedQuery<Rewards | null>(
    'today:rewards',
    (supabase, userId) => supabase
      .from('user_rewards')
      .select('current_perfect_streak, last_perfect_date')
      .eq('user_id', userId)
      .maybeSingle(),
    null,
  )

  // Freezes and chest come from migration 049 — fetched separately so an
  // unapplied migration only hides these extras (the query errors and
  // isOffline flips) instead of breaking the rest of the card.
  const { data: freezeRow, isOffline: freezesUnavailable, refetch: refetchFreezes } = useCachedQuery<Freezes | null>(
    'today:freezes',
    (supabase, userId) => supabase.from('user_rewards').select('streak_freezes').eq('user_id', userId).maybeSingle(),
    null,
  )
  const { data: chest, isOffline: chestUnavailable, setData: setChest } = useCachedQuery<ChestClaim | null>(
    `today:chest:${today}`,
    (supabase, userId) => supabase
      .from('daily_chest_claims')
      .select('claim_date, chest_streak, points, freeze:gave_freeze, label')
      .eq('user_id', userId)
      .eq('claim_date', today)
      .maybeSingle(),
    null,
    [today],
  )
  const [openingChest, setOpeningChest] = useState(false)
  const freezes = freezesUnavailable ? 0 : freezeRow?.streak_freezes ?? 0

  const { byHabit: leverage } = useHabitLeverage()
  const { inFlight, begin, end } = useInFlightIds()
  const { celebrate, celebrationNode } = useHabitCelebration()
  const { celebrateMilestones } = useReward()

  const hiddenIds   = useMemo(() => new Set(hidden.map(h => h.habit_id)), [hidden])
  const keystoneIds = useMemo(() => new Set(globalKeystones.map(k => k.habit_id)), [globalKeystones])

  function statusOf(h: Habit): Status {
    const log = logs.find(l => l.habit_id === h.id)
    if (log) return log.status === 'done' ? 'done' : 'skipped'
    // Same fallback as HabitTracker.getStatus — never for global habits,
    // whose last_done_at is one shared column across every user.
    if (!h.is_global && h.last_done_at && localDateStr(new Date(h.last_done_at)) === today) return 'done'
    return 'pending'
  }
  const isKeystone  = (h: Habit) => h.is_global ? keystoneIds.has(h.id) : h.is_keystone
  // A streak only counts as "at stake" if it's still alive going into today.
  const liveStreak  = (h: Habit) => {
    if (h.is_global || !h.last_done_at || h.streak_count <= 0) return 0
    const last = localDateStr(new Date(h.last_done_at))
    return last === yesterday || last === today ? h.streak_count : 0
  }
  // Missed exactly yesterday: completing today spends a freeze to save it.
  const frozenStreak = (h: Habit) => {
    if (h.is_global || !h.last_done_at || h.streak_count <= 0 || freezes === 0) return 0
    return localDateStr(new Date(h.last_done_at)) === prevDate(yesterday) ? h.streak_count : 0
  }

  const visible = habits.filter(h => !h.is_global || !hiddenIds.has(h.id))
  const pending = visible
    .filter(h => statusOf(h) === 'pending')
    .sort((a, b) => Number(isKeystone(b)) - Number(isKeystone(a)) || liveStreak(b) - liveStreak(a))
  const done    = visible.filter(h => statusOf(h) === 'done')
  const actionable = visible.length - visible.filter(h => statusOf(h) === 'skipped').length
  const pct     = actionable ? Math.round((done.length / actionable) * 100) : 0

  const perfectStreak =
    rewards && (rewards.last_perfect_date === today || rewards.last_perfect_date === yesterday)
      ? rewards.current_perfect_streak : 0
  const perfectToday = rewards?.last_perfect_date === today

  async function markDone(habit: Habit) {
    if (statusOf(habit) !== 'pending' || !begin(habit.id)) return
    // Optimistic write through the cached logs — useCachedQuery discards any
    // in-flight fetch that started before it, so it can't be reverted.
    setLogs(prev => [...prev.filter(l => l.habit_id !== habit.id), { habit_id: habit.id, status: 'done' }])
    try {
      const { streak_count, milestones } = await completeHabit(habit.id)
      setHabits(prev => prev.map(h => h.id === habit.id
        ? { ...h, streak_count, longest_streak: Math.max(streak_count, h.longest_streak), last_done_at: new Date().toISOString() }
        : h))
      celebrate()
      celebrateMilestones(milestones)
      refetchRewards()  // may have just completed a perfect day
      if (milestones.some(m => m.kind === 'freeze')) refetchFreezes()
    } catch {
      setLogs(prev => prev.filter(l => !(l.habit_id === habit.id && l.status === 'done')))
    }
    end(habit.id)
  }

  async function openChest() {
    if (openingChest || chest) return
    setOpeningChest(true)
    try {
      const res = await fetch('/api/rewards/daily-chest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: today }),
      })
      if (res.ok) {
        const { claim, alreadyClaimed } = await res.json() as { claim: ChestClaim; alreadyClaimed: boolean }
        setChest(claim)
        if (!alreadyClaimed) {
          celebrateMilestones([{ label: `Day ${claim.chest_streak} chest: ${claim.label}`, points: claim.points, kind: 'chest' }])
          if (claim.freeze) refetchFreezes()
        }
      }
    } finally {
      setOpeningChest(false)
    }
  }

  const loading = (habitsLoading || logsLoading) && habits.length === 0

  return (
    <div id="today" className="rounded-2xl border border-white/8 bg-white/3 p-5 space-y-4">
      {celebrationNode}

      {/* Header + progress */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Flame className="h-4 w-4 text-orange-400 shrink-0" />
          <span className="text-sm font-semibold text-white">Today&apos;s Habits</span>
          {actionable > 0 && (
            <span className="text-xs text-slate-500">{done.length}/{actionable}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {freezes > 0 && (
            <span
              title={`${freezes} streak freeze${freezes === 1 ? '' : 's'}: each one saves your streaks if you miss a single day`}
              className="flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-0.5 text-[11px] font-medium text-sky-300"
            >
              <Snowflake className="h-3 w-3" />
              {freezes}
            </span>
          )}
          {perfectStreak > 0 && (
            <span
              title="Consecutive days with every daily habit done"
              className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-300"
            >
              <Trophy className="h-3 w-3" />
              {perfectStreak}-day perfect
            </span>
          )}
        </div>
      </div>

      {actionable > 0 && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-orange-500 to-emerald-400 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-slate-500" /></div>
      ) : visible.length === 0 ? (
        <Link href="/personality/habits" className="block text-center text-xs text-slate-500 hover:text-white py-2">
          No habits yet — add your first one →
        </Link>
      ) : pending.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
          <Sparkles className="h-5 w-5 text-emerald-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-200">
              {perfectToday ? 'Perfect day locked in' : 'All done for today'}
            </p>
            <p className="text-xs text-slate-400">
              {perfectStreak > 1 ? `${perfectStreak} perfect days in a row. See you tomorrow.` : 'Come back tomorrow to keep it going.'}
            </p>
          </div>
        </div>
      ) : (
        <ul className="space-y-2">
          {pending.map(habit => {
            const streak  = liveStreak(habit)
            const frozen  = frozenStreak(habit)
            const why     = leverageLine(leverage.get(habit.id), today)
            const marking = inFlight.has(habit.id)
            return (
              <li key={habit.id}>
                <button
                  type="button"
                  onClick={() => markDone(habit)}
                  disabled={marking}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all active:scale-[0.98]',
                    isKeystone(habit)
                      ? 'border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50'
                      : 'border-white/10 bg-white/5 hover:border-emerald-500/30',
                  )}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-slate-600">
                    {marking && <Loader2 className="h-3 w-3 animate-spin text-slate-400" />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-1.5">
                      {isKeystone(habit) && <Crown className="h-3.5 w-3.5 shrink-0 text-amber-400" />}
                      <span className="text-sm font-medium text-white line-clamp-1">{habit.habit_name}</span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5">
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full', HABIT_CATEGORY_META[habit.category]?.badge ?? 'bg-white/10 text-slate-400')}>
                        {HABIT_CATEGORY_META[habit.category]?.label ?? habit.category}
                      </span>
                      {streak > 0 && (
                        <span className="text-[11px] text-orange-400">🔥 {streak} — keep it alive</span>
                      )}
                      {frozen > 0 && (
                        <span className="text-[11px] text-sky-300">🧊 {frozen} — a freeze will save it today</span>
                      )}
                    </span>
                    {why && <span className="mt-0.5 block text-[11px] italic text-slate-400 line-clamp-1">{why}</span>}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {done.length > 0 && pending.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {done.map(h => (
            <span key={h.id} className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300/80">
              <Check className="h-3 w-3" />
              <span className="line-through decoration-emerald-500/40">{h.habit_name}</span>
            </span>
          ))}
        </div>
      )}

      {/* Daily chest — unlocked by the day's first completed habit */}
      {!chestUnavailable && visible.length > 0 && (
        chest ? (
          <p className="flex items-center gap-1.5 text-xs text-slate-400">
            <Gift className="h-3.5 w-3.5 text-amber-400/70" />
            Today&apos;s chest: {chest.label}
            <span className="text-slate-600">· {chest.chest_streak}-day chest streak</span>
          </p>
        ) : done.length > 0 ? (
          <button
            type="button"
            onClick={openChest}
            disabled={openingChest}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-500/20 to-orange-500/10 px-4 py-3 text-sm font-semibold text-amber-200 shadow-[0_0_16px_-4px_rgba(245,158,11,0.5)] transition-all active:scale-[0.98] animate-pulse"
          >
            {openingChest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
            Daily chest unlocked — tap to open
          </button>
        ) : (
          <p className="flex items-center gap-1.5 text-xs text-slate-600">
            <Lock className="h-3 w-3" />
            Finish one habit to unlock today&apos;s chest
          </p>
        )
      )}

      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-600">{pending.length > 0 ? 'Tap a habit to mark it done' : ''}</span>
        <Link href="/personality/habits" className="flex items-center gap-1 text-slate-500 hover:text-white transition-colors">
          Undo, skip &amp; history <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  )
}
