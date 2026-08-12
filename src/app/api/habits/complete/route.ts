import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { computeStreak, todayStr, yesterdayStr } from '@/lib/habitStreak'
import {
  highestMilestoneCrossed, PER_HABIT_MILESTONE_POINTS, OVERALL_MILESTONE_POINTS,
  DAILY_POINTS, DAILY_POINTS_KEYSTONE,
} from '@/lib/rewardMilestones'
import { isPerfectDay } from '@/lib/perfectDay'

type SupabaseClient = ReturnType<typeof createSupabaseServerClient>

interface Milestone { label: string; points: number }

async function awardPoints(supabase: SupabaseClient, userId: string, delta: number, reason: string) {
  await supabase.from('reward_points_log').insert({ user_id: userId, delta, reason })
  await supabase.rpc('increment_points_balance', { p_user_id: userId, p_delta: delta })
}

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { habit_id, for: forDay } = await req.json() as { habit_id?: string; for?: 'today' | 'yesterday' }
  if (!habit_id) return NextResponse.json({ error: 'habit_id required' }, { status: 400 })
  const isYesterday = forDay === 'yesterday'

  const { data: habit, error: habitErr } = await supabase
    .from('personality_habits')
    .select('id, habit_name, streak_count, longest_streak, last_done_at, frequency, is_keystone, is_global, last_milestone_awarded')
    .eq('id', habit_id)
    .single()
  if (habitErr || !habit) return NextResponse.json({ error: 'Habit not found' }, { status: 404 })

  // Reference point for every date-sensitive calculation below — "today"
  // in the normal case, "yesterday" for a grace-period catch-up. Mirrors
  // markDoneForYesterday's existing client-side behavior exactly.
  const refDate  = isYesterday ? (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d })() : new Date()
  const logDate  = isYesterday ? yesterdayStr() : todayStr()
  const now       = new Date().toISOString()
  const refIso    = isYesterday ? refDate.toISOString() : now
  const milestones: Milestone[] = []

  // Defense-in-depth mirroring markDoneForYesterday's client-side guard:
  // never roll last_done_at backwards. If the habit already has a
  // last_done_at on/after the reference day, this call is stale/replayed.
  if (isYesterday && habit.last_done_at) {
    const lastMidnight = new Date(habit.last_done_at); lastMidnight.setHours(0, 0, 0, 0)
    const refMidnight   = new Date(refDate);            refMidnight.setHours(0, 0, 0, 0)
    if (lastMidnight.getTime() >= refMidnight.getTime()) {
      return NextResponse.json({ error: 'Already up to date' }, { status: 409 })
    }
  }

  // 1. Upsert the log for the target day as done
  await supabase.from('habit_logs').upsert(
    { user_id: user.id, habit_id: habit.id, log_date: logDate, status: 'done' },
    { onConflict: 'habit_id,user_id,log_date' }
  )

  // 2. Update streak — skipped for global habits (shared row across every
  // user, so no per-user streak can live on it; matches existing client behavior).
  let newStreak = habit.streak_count
  if (!habit.is_global) {
    newStreak = computeStreak(habit.streak_count, habit.last_done_at, habit.frequency, refDate)
    await supabase.from('personality_habits').update({
      streak_count:   newStreak,
      longest_streak: Math.max(newStreak, habit.longest_streak),
      last_done_at:   refIso,
      updated_at:     now,
    }).eq('id', habit.id)
  }

  // 3. Ensure a user_rewards row exists before awarding anything
  await supabase.from('user_rewards').upsert(
    { user_id: user.id },
    { onConflict: 'user_id', ignoreDuplicates: true }
  )

  // 4. Daily points
  const dailyPoints = habit.is_keystone ? DAILY_POINTS_KEYSTONE : DAILY_POINTS
  await awardPoints(supabase, user.id, dailyPoints, `Daily: ${habit.habit_name}`)

  // 5. Per-habit milestone — skipped for global habits, same reason as step 2
  if (!habit.is_global) {
    const lastAwarded = habit.last_milestone_awarded ?? 0
    // A broken-and-restarted streak (newStreak === 1) resets the ladder.
    const baseline = newStreak === 1 ? 0 : lastAwarded
    const crossed  = highestMilestoneCrossed(newStreak)
    if (crossed > baseline) {
      const points = PER_HABIT_MILESTONE_POINTS[crossed]
      await awardPoints(supabase, user.id, points, `Milestone: ${habit.habit_name} ${crossed}-day streak`)
      await supabase.from('personality_habits').update({ last_milestone_awarded: crossed }).eq('id', habit.id)
      milestones.push({ label: `${habit.habit_name} — ${crossed}-day streak!`, points })
    } else if (baseline !== lastAwarded) {
      await supabase.from('personality_habits').update({ last_milestone_awarded: 0 }).eq('id', habit.id)
    }
  }

  // 6. Perfect-day check for the SAME target day (today or yesterday),
  // including global habits (visible in every user's tracker) but
  // excluding any global habit this user has hidden — matches every
  // other place hidden global habits are excluded.
  const [{ data: dailyHabitsRaw }, { data: logsForDay }, { data: hiddenMarks }, { data: rewards }] = await Promise.all([
    supabase.from('personality_habits').select('id, frequency, is_global')
      .or(`user_id.eq.${user.id},is_global.eq.true`).eq('frequency', 'daily'),
    supabase.from('habit_logs').select('habit_id, status')
      .eq('user_id', user.id).eq('log_date', logDate),
    supabase.from('user_hidden_habits').select('habit_id').eq('user_id', user.id),
    supabase.from('user_rewards').select('current_perfect_streak, longest_perfect_streak, last_perfect_date, last_overall_milestone')
      .eq('user_id', user.id).single(),
  ])

  const hiddenIds   = new Set((hiddenMarks ?? []).map(h => h.habit_id))
  const dailyHabits = (dailyHabitsRaw ?? []).filter(h => !h.is_global || !hiddenIds.has(h.id))

  if (rewards && isPerfectDay(dailyHabits, logsForDay ?? []) && rewards.last_perfect_date !== logDate) {
    const priorDay        = isYesterday ? (() => { const d = new Date(); d.setDate(d.getDate() - 2); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-') })() : yesterdayStr()
    const newPerfect       = rewards.last_perfect_date === priorDay ? rewards.current_perfect_streak + 1 : 1
    const longestPerfect   = Math.max(newPerfect, rewards.longest_perfect_streak)
    const overallBaseline  = newPerfect === 1 ? 0 : rewards.last_overall_milestone
    const overallCrossed   = highestMilestoneCrossed(newPerfect)

    await supabase.from('user_rewards').update({
      current_perfect_streak: newPerfect,
      longest_perfect_streak: longestPerfect,
      last_perfect_date:      logDate,
      last_overall_milestone: overallCrossed > overallBaseline ? overallCrossed : overallBaseline,
      updated_at:              now,
    }).eq('user_id', user.id)

    if (overallCrossed > overallBaseline) {
      const points = OVERALL_MILESTONE_POINTS[overallCrossed]
      await awardPoints(supabase, user.id, points, `Milestone: Perfect day streak ${overallCrossed} days`)
      milestones.push({ label: `Perfect Day Streak — ${overallCrossed} days!`, points })
    }
  }

  return NextResponse.json({ streak_count: newStreak, milestones })
}
