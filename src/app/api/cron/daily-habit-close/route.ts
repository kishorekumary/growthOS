import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { runBankEmailSync } from '@/lib/bank-email-sync'

// Returns the previous calendar date (YYYY-MM-DD) in the given IANA timezone.
// Example: at 01:00 UTC on 2026-05-30, a UTC+5:30 user's yesterday = 2026-05-29.
function localYesterday(timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date()).map(p => [p.type, p.value])
  )
  const d = new Date(`${parts.year}-${parts.month}-${parts.day}`)
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

export async function GET(req: NextRequest) {
  // Accept cron secret OR a valid logged-in session (for manual testing in browser)
  const cronSecret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')
  let authorized = !cronSecret || auth === `Bearer ${cronSecret}`
  if (!authorized) {
    const { data: { user } } = await createSupabaseServerClient().auth.getUser()
    authorized = !!user
  }
  if (!authorized) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createSupabaseAdminClient()

  // 1. All registered users
  const { data: { users: authUsers } } = await admin.auth.admin.listUsers({ perPage: 1000 })

  // 2. Per-user timezones from notification_settings (falls back to UTC)
  const { data: tzRows } = await admin
    .from('notification_settings')
    .select('user_id, timezone')
  const tzMap: Record<string, string> = Object.fromEntries(
    (tzRows ?? []).map(r => [r.user_id, r.timezone ?? 'UTC'])
  )

  // 3. All daily habits (both user-owned and global)
  const { data: allHabits, error: habitsErr } = await admin
    .from('personality_habits')
    .select('id, user_id, is_global')
    .eq('frequency', 'daily')

  if (habitsErr) {
    // habit_logs table or personality_habits not yet migrated — nothing to do
    return NextResponse.json({ ok: true, inserted: 0, note: habitsErr.message })
  }

  const globalHabitIds = (allHabits ?? []).filter(h => h.is_global).map(h => h.id)

  // Map each user to their own (non-global) daily habit IDs
  const userHabitMap: Record<string, string[]> = {}
  for (const h of (allHabits ?? []).filter(h => !h.is_global)) {
    if (!userHabitMap[h.user_id]) userHabitMap[h.user_id] = []
    userHabitMap[h.user_id].push(h.id)
  }

  // Global habits each user has opted out of — same opt-out filtering logic as
  // HabitTracker.tsx's `visibleHabits` (!h.is_global || !hiddenHabitIds.has(h.id)),
  // applied here so the cron never inserts 'missed' logs for a habit the user
  // can no longer see or act on.
  const { data: hiddenRows } = await admin
    .from('user_hidden_habits')
    .select('user_id, habit_id')
  const hiddenHabitsByUser: Record<string, Set<string>> = {}
  for (const r of (hiddenRows ?? [])) {
    if (!hiddenHabitsByUser[r.user_id]) hiddenHabitsByUser[r.user_id] = new Set()
    hiddenHabitsByUser[r.user_id].add(r.habit_id)
  }

  let totalInserted = 0

  for (const u of authUsers) {
    const tz        = tzMap[u.id] ?? 'UTC'
    const yesterday = localYesterday(tz)

    // Habits this user is responsible for: own daily habits + all global daily
    // habits the user hasn't hidden. Personal habits are never filtered here.
    const hiddenForUser = hiddenHabitsByUser[u.id]
    const visibleGlobalHabitIds = hiddenForUser
      ? globalHabitIds.filter(id => !hiddenForUser.has(id))
      : globalHabitIds
    const habitIds = [...(userHabitMap[u.id] ?? []), ...visibleGlobalHabitIds]
    if (!habitIds.length) continue

    // Find habits that already have ANY log (done or missed) for yesterday
    const { data: existing } = await admin
      .from('habit_logs')
      .select('habit_id')
      .eq('user_id', u.id)
      .eq('log_date', yesterday)
      .in('habit_id', habitIds)

    const logged  = new Set((existing ?? []).map(l => l.habit_id))
    const missing = habitIds.filter(id => !logged.has(id))
    if (!missing.length) continue

    // Insert an 'auto_missed' log for each unlogged habit — distinct from a
    // user-initiated 'missed' (skip) so isPerfectDay (src/lib/perfectDay.ts)
    // never treats this silent backfill as "handled." Every other read site
    // (HabitTracker, QuickLog) normalizes 'auto_missed' back to 'missed' for
    // display/undo purposes; only perfect-day scoring needs to tell them apart.
    const { error: insertErr } = await admin
      .from('habit_logs')
      .insert(
        missing.map(habit_id => ({
          user_id:  u.id,
          habit_id,
          log_date: yesterday,
          status:   'auto_missed',
        }))
      )

    if (!insertErr) totalInserted += missing.length
  }

  // Piggybacks on this once-daily cron rather than its own entry — Vercel Hobby
  // caps projects at 2 cron jobs run at most once a day.
  const bankSync = await runBankEmailSync(admin).catch(err => {
    console.error('[cron/daily-habit-close] bank email sync failed', err)
    return { processed: 0, imported: 0 }
  })

  return NextResponse.json({ ok: true, inserted: totalInserted, bankSync })
}
