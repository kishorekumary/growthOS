import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { computeStreak, localDateStr } from '@/lib/habitStreak'
import {
  highestMilestoneCrossed, PER_HABIT_MILESTONE_POINTS, OVERALL_MILESTONE_POINTS,
  DAILY_POINTS, DAILY_POINTS_KEYSTONE,
} from '@/lib/rewardMilestones'
import { isPerfectDay } from '@/lib/perfectDay'

type SupabaseClient = ReturnType<typeof createSupabaseServerClient>

interface Milestone { label: string; points: number }

// Returns whether the points actually landed (both the log insert and the
// balance RPC succeeded). Callers must not tell the client a milestone was
// awarded — or persist any "already awarded" marker — when this is false.
async function awardPoints(supabase: SupabaseClient, userId: string, delta: number, reason: string): Promise<boolean> {
  const { error: logError } = await supabase.from('reward_points_log').insert({ user_id: userId, delta, reason })
  if (logError) {
    console.error('awardPoints: failed to insert reward_points_log', { userId, delta, reason, error: logError })
    return false
  }
  const { error: rpcError } = await supabase.rpc('increment_points_balance', { p_user_id: userId, p_delta: delta })
  if (rpcError) {
    console.error('awardPoints: increment_points_balance RPC failed', { userId, delta, reason, error: rpcError })
    return false
  }
  return true
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { habit_id, for: forDay, date: clientDate } = await req.json() as {
    habit_id?: string; for?: 'today' | 'yesterday'; date?: string
  }
  if (!habit_id) return NextResponse.json({ error: 'habit_id required' }, { status: 400 })
  const isYesterday = forDay === 'yesterday'

  // The client (browser) computes "today"/"yesterday" in the user's own local
  // timezone and sends it as `date` — this server runtime resolves plain JS
  // Date methods to its own timezone (UTC in production), not the user's, so
  // it cannot reliably derive the correct calendar day itself. This is only a
  // loose sanity bound against a garbage/malicious client value (not an
  // attempt at full timezone correctness): reject anything wildly off from
  // the server's own current UTC date.
  if (!clientDate || !DATE_RE.test(clientDate)) {
    return NextResponse.json({ error: 'date required (YYYY-MM-DD)' }, { status: 400 })
  }
  const serverUtcToday      = new Date().toISOString().slice(0, 10)
  const clientMidnightUtcMs = new Date(`${clientDate}T00:00:00Z`).getTime()
  const serverMidnightUtcMs = new Date(`${serverUtcToday}T00:00:00Z`).getTime()
  const dayDiff             = Math.round((clientMidnightUtcMs - serverMidnightUtcMs) / 86400000)
  if (Number.isNaN(clientMidnightUtcMs) || Math.abs(dayDiff) > 2) {
    return NextResponse.json({ error: 'date is out of range' }, { status: 400 })
  }

  const { data: habit, error: habitErr } = await supabase
    .from('personality_habits')
    .select('id, habit_name, streak_count, longest_streak, last_done_at, frequency, is_keystone, is_global, last_milestone_awarded')
    .eq('id', habit_id)
    .single()
  if (habitErr || !habit) return NextResponse.json({ error: 'Habit not found' }, { status: 404 })

  // Reference point for every date-sensitive calculation below — "today"
  // in the normal case, "yesterday" for a grace-period catch-up. Derived
  // from the client-supplied date, parsed as a *local-midnight* Date (no
  // trailing "Z") rather than `new Date(clientDate)` alone (which parses as
  // UTC midnight and could shift the calendar day depending on the server's
  // timezone offset). computeStreak/isPerfectDay/the guard below only ever
  // compare day-granularity differences, not absolute time, so this is safe.
  const logDate = clientDate
  const refDate = new Date(`${clientDate}T00:00:00`)
  const now     = new Date().toISOString()
  const refIso  = isYesterday ? refDate.toISOString() : now
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

  // Idempotency guard for the common "today" path (and a second layer for
  // "yesterday", alongside the stale-replay guard above): if this exact
  // (habit_id, user_id, log_date) row is already 'done', this call is a
  // repeat — a network retry, a double-submit, or a future caller that
  // re-invokes this route. Nothing changed, so skip every write and award
  // and return the habit's current (unchanged) streak.
  const { data: existingLog } = await supabase
    .from('habit_logs')
    .select('status')
    .eq('habit_id', habit.id)
    .eq('user_id', user.id)
    .eq('log_date', logDate)
    .maybeSingle()
  if (existingLog?.status === 'done') {
    return NextResponse.json({ streak_count: habit.streak_count, milestones: [] })
  }

  // 1. Upsert the log for the target day as done. This is the point of no
  // return for this request — if it fails, bail out before any further
  // writes or point awards happen.
  const { error: logUpsertErr } = await supabase.from('habit_logs').upsert(
    { user_id: user.id, habit_id: habit.id, log_date: logDate, status: 'done' },
    { onConflict: 'habit_id,user_id,log_date' }
  )
  if (logUpsertErr) {
    console.error('POST /api/habits/complete: habit_logs upsert failed', logUpsertErr)
    return NextResponse.json({ error: 'Failed to record habit completion' }, { status: 500 })
  }

  // 2. Update streak — skipped for global habits (shared row across every
  // user, so no per-user streak can live on it; matches existing client behavior).
  let newStreak = habit.streak_count
  if (!habit.is_global) {
    newStreak = computeStreak(habit.streak_count, habit.last_done_at, habit.frequency, refDate)
    const { error: streakUpdateErr } = await supabase.from('personality_habits').update({
      streak_count:   newStreak,
      longest_streak: Math.max(newStreak, habit.longest_streak),
      last_done_at:   refIso,
      updated_at:     now,
    }).eq('id', habit.id)
    if (streakUpdateErr) {
      console.error('POST /api/habits/complete: personality_habits streak update failed', streakUpdateErr)
    }
  }

  // 3. Ensure a user_rewards row exists before awarding anything. This is a
  // point of no return the same way the habit_logs upsert above is: if it
  // fails, increment_points_balance's UPDATE ... WHERE user_id = ... below
  // would match zero rows and return no error, so awardPoints would report
  // success even though no points moved — and if this happens to land on a
  // milestone-crossing call, last_milestone_awarded would get persisted as
  // paid without the points actually landing, permanently blocking that
  // milestone. Bail out before any award/milestone/perfect-day logic runs.
  const { error: rewardsUpsertErr } = await supabase.from('user_rewards').upsert(
    { user_id: user.id },
    { onConflict: 'user_id', ignoreDuplicates: true }
  )
  if (rewardsUpsertErr) {
    console.error('POST /api/habits/complete: user_rewards upsert failed', rewardsUpsertErr)
    return NextResponse.json({ error: 'Failed to initialize rewards' }, { status: 500 })
  }

  // 3b. Keystone-ness for a GLOBAL habit is per-user (user_habit_keystones),
  // not the shared personality_habits.is_keystone column — that column means
  // nothing per-user for a row shared across every user. Mirrors
  // HabitTracker.tsx's isKeystoneFor(habit). Personal (non-global) habits
  // keep using habit.is_keystone directly, unchanged.
  let isKeystone = habit.is_keystone
  if (habit.is_global) {
    const { data: keystoneMark } = await supabase
      .from('user_habit_keystones')
      .select('habit_id')
      .eq('user_id', user.id)
      .eq('habit_id', habit.id)
      .maybeSingle()
    isKeystone = !!keystoneMark
  }

  // 4. Daily points
  const dailyPoints = isKeystone ? DAILY_POINTS_KEYSTONE : DAILY_POINTS
  await awardPoints(supabase, user.id, dailyPoints, `Daily: ${habit.habit_name}`)

  // 5. Per-habit milestone — skipped for global habits, same reason as step 2
  if (!habit.is_global) {
    const lastAwarded = habit.last_milestone_awarded ?? 0
    // A broken-and-restarted streak (newStreak === 1) resets the ladder.
    const baseline = newStreak === 1 ? 0 : lastAwarded
    const crossed  = highestMilestoneCrossed(newStreak)
    if (crossed > baseline) {
      const points = PER_HABIT_MILESTONE_POINTS[crossed]
      const awarded = await awardPoints(supabase, user.id, points, `Milestone: ${habit.habit_name} ${crossed}-day streak`)
      if (awarded) {
        // Only persist the "already awarded" marker and tell the client
        // about the milestone if the points actually landed — otherwise
        // leave last_milestone_awarded alone so a future call can retry.
        await supabase.from('personality_habits').update({ last_milestone_awarded: crossed }).eq('id', habit.id)
        milestones.push({ label: `${habit.habit_name} — ${crossed}-day streak!`, points })
      }
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
    // Calendar day immediately before logDate, computed by pure local-date
    // arithmetic on the client-supplied date (never via server "now") — same
    // reasoning as refDate above.
    const priorDate = new Date(`${logDate}T00:00:00`)
    priorDate.setDate(priorDate.getDate() - 1)
    const priorDay = localDateStr(priorDate)

    const newPerfect       = rewards.last_perfect_date === priorDay ? rewards.current_perfect_streak + 1 : 1
    const longestPerfect   = Math.max(newPerfect, rewards.longest_perfect_streak)
    const overallBaseline  = newPerfect === 1 ? 0 : rewards.last_overall_milestone
    const overallCrossed   = highestMilestoneCrossed(newPerfect)

    // Award (if crossed) before persisting last_overall_milestone, so a
    // failed award doesn't get recorded as if it succeeded — that would
    // permanently block a retry on a future call.
    const overallPoints = OVERALL_MILESTONE_POINTS[overallCrossed]
    const overallAwarded = overallCrossed > overallBaseline
      ? await awardPoints(supabase, user.id, overallPoints, `Milestone: Perfect day streak ${overallCrossed} days`)
      : false

    const { error: rewardsUpdateErr } = await supabase.from('user_rewards').update({
      current_perfect_streak: newPerfect,
      longest_perfect_streak: longestPerfect,
      last_perfect_date:      logDate,
      last_overall_milestone: overallAwarded ? overallCrossed : overallBaseline,
      updated_at:              now,
    }).eq('user_id', user.id)
    if (rewardsUpdateErr) {
      console.error('POST /api/habits/complete: user_rewards perfect-day update failed', rewardsUpdateErr)
    }

    if (overallAwarded) {
      milestones.push({ label: `Perfect Day Streak — ${overallCrossed} days!`, points: overallPoints })
    }
  }

  return NextResponse.json({ streak_count: newStreak, milestones })
}
