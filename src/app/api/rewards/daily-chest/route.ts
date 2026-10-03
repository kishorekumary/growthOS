import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { awardPoints } from '@/lib/awardPoints'
import { isPlausibleClientDate } from '@/lib/clientDate'
import { FREEZE_MAX, prevDate, resolveFreezeCap, rollChest } from '@/lib/dailyChest'

// Opens the day's chest. Unlocked by completing at least one habit that day;
// one claim per user per local day (daily_chest_claims primary key), so a
// retry or double-tap returns the original result instead of re-rolling.
export async function POST(req: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { date } = await req.json().catch(() => ({})) as { date?: unknown }
  if (!isPlausibleClientDate(date)) {
    return NextResponse.json({ error: 'date required (YYYY-MM-DD)' }, { status: 400 })
  }

  // gave_freeze is aliased back to `freeze` for the client ("freeze" is reserved in Postgres).
  const columns = 'claim_date, chest_streak, points, freeze:gave_freeze, label'
  const { data: existing } = await supabase
    .from('daily_chest_claims').select(columns)
    .eq('user_id', user.id).eq('claim_date', date).maybeSingle()
  if (existing) return NextResponse.json({ claim: existing, alreadyClaimed: true })

  const { count: doneToday } = await supabase
    .from('habit_logs').select('habit_id', { count: 'exact', head: true })
    .eq('user_id', user.id).eq('log_date', date).eq('status', 'done')
  if (!doneToday) {
    return NextResponse.json({ error: 'Complete a habit today to unlock the chest' }, { status: 403 })
  }

  const { data: prev } = await supabase
    .from('daily_chest_claims').select('chest_streak')
    .eq('user_id', user.id).eq('claim_date', prevDate(date)).maybeSingle()
  const chestStreak = (prev?.chest_streak ?? 0) + 1

  let roll = rollChest(chestStreak)

  // Claim first: the primary key makes this the idempotency point, so a
  // concurrent request can't also pay out.
  const { error: insertErr } = await supabase.from('daily_chest_claims').insert({
    user_id: user.id, claim_date: date, chest_streak: chestStreak,
    points: roll.points, gave_freeze: roll.freeze, label: roll.label,
  })
  if (insertErr) {
    const { data: raced } = await supabase
      .from('daily_chest_claims').select(columns)
      .eq('user_id', user.id).eq('claim_date', date).maybeSingle()
    if (raced) return NextResponse.json({ claim: raced, alreadyClaimed: true })
    console.error('POST /api/rewards/daily-chest: claim insert failed', insertErr)
    return NextResponse.json({ error: 'Chest unavailable' }, { status: 500 })
  }

  const { error: rewardsUpsertErr } = await supabase.from('user_rewards').upsert(
    { user_id: user.id }, { onConflict: 'user_id', ignoreDuplicates: true }
  )
  if (rewardsUpsertErr) console.error('POST /api/rewards/daily-chest: user_rewards upsert failed', rewardsUpsertErr)

  if (roll.freeze) {
    const { data: granted } = await supabase.rpc('grant_streak_freeze', { p_user_id: user.id, p_max: FREEZE_MAX })
    const resolved = resolveFreezeCap(roll, granted === true)
    if (resolved !== roll) {
      roll = resolved
      await supabase.from('daily_chest_claims')
        .update({ points: roll.points, gave_freeze: roll.freeze, label: roll.label })
        .eq('user_id', user.id).eq('claim_date', date)
    }
  }
  if (roll.points > 0) await awardPoints(supabase, user.id, roll.points, `Daily chest (day ${chestStreak})`)

  return NextResponse.json({
    claim: { claim_date: date, chest_streak: chestStreak, ...roll },
    alreadyClaimed: false,
  })
}
