import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import webpush from 'web-push'
import { Resend } from 'resend'
import twilio from 'twilio'
import { sendTelegramMessage } from '@/lib/telegram'
import {
  buildReminder, buildStreakRiskNudge, dueReminderTimes,
  type ReminderHabit, type ReminderMessage,
} from '@/lib/reminderMessage'
import { POWER_TAG } from '@/lib/powerQuestions'
import { WORKBOOK_TAG, workbookStatus } from '@/lib/workbook'

type AdminClient = ReturnType<typeof createSupabaseAdminClient>

// Triggered every 15 minutes by .github/workflows/reminders.yml (Vercel Hobby
// crons only run once a day), plus the daily vercel.json entry as a backstop.
// Each run sends only the reminders that fell due within the last hour, so
// running more or less often never double-sends or fires early.

// Late-evening "last call", sent only when a live streak would break tonight.
const STREAK_RISK_TIME = '21:00'
const STREAK_RISK_KEY  = '__streak_risk'

// Returns current local time and date string in the given IANA timezone
function localNow(timezone: string): { minutes: number; dateStr: string; yesterdayStr: string } {
  const now = new Date()
  const fmt = (d: Date) => Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(d).map(p => [p.type, p.value])
  )
  const p = fmt(now)
  const y = fmt(new Date(now.getTime() - 86400000))
  return {
    minutes:      (parseInt(p.hour ?? '0') % 24) * 60 + parseInt(p.minute ?? '0'),
    dateStr:      `${p.year}-${p.month}-${p.day}`,
    yesterdayStr: `${y.year}-${y.month}-${y.day}`,
  }
}

// Pure calendar arithmetic on a YYYY-MM-DD string — no timezone involved.
function prevDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

// last_done_at is written by /api/habits/complete as noon UTC of the user's
// local day (so its date part *is* that day); older client-written values
// are real instants and need converting into the user's timezone.
function lastDoneLocalDate(lastDoneAt: string, timezone: string): string {
  if (lastDoneAt.endsWith('T12:00:00.000Z')) return lastDoneAt.slice(0, 10)
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date(lastDoneAt))
}

interface HabitState {
  pending: ReminderHabit[]; doneCount: number; perfectStreak: number; powerDone: Set<string>
  exerciseDue: string | null
}

// Today's habit picture for one user: visible daily habits (own + global
// minus hidden) with no log yet today — same visibility rules as HabitTracker.
async function loadHabitState(
  admin: AdminClient, userId: string, timezone: string, today: string, yesterday: string,
): Promise<HabitState> {
  const [
    { data: habits }, { data: hidden }, { data: keystones }, { data: logs }, { data: rewards },
    { data: leverageRows }, { data: powerRows }, { data: workbookRows },
  ] = await Promise.all([
    admin.from('personality_habits')
      .select('id, habit_name, streak_count, last_done_at, is_keystone, is_global')
      .or(`user_id.eq.${userId},is_global.eq.true`)
      .eq('frequency', 'daily'),
    admin.from('user_hidden_habits').select('habit_id').eq('user_id', userId),
    admin.from('user_habit_keystones').select('habit_id').eq('user_id', userId),
    admin.from('habit_logs').select('habit_id, status').eq('user_id', userId).eq('log_date', today),
    admin.from('user_rewards').select('current_perfect_streak, last_perfect_date').eq('user_id', userId).maybeSingle(),
    // Both optional: habit_leverage needs migration 050; errors just mean no data.
    admin.from('habit_leverage').select('habit_id, pain, pleasure').eq('user_id', userId),
    admin.from('journal_entries').select('tags').eq('user_id', userId).eq('entry_date', today)
      .overlaps('tags', [POWER_TAG.morning, POWER_TAG.evening]),
    admin.from('journal_entries').select('entry_date, tags').eq('user_id', userId).contains('tags', [WORKBOOK_TAG]),
  ])
  const leverage = new Map((leverageRows ?? []).map(l => [l.habit_id, (l.pain ?? l.pleasure) as string | null]))
  const powerDone = new Set((powerRows ?? []).flatMap(r => (r.tags ?? []) as string[]))

  const hiddenIds   = new Set((hidden ?? []).map(h => h.habit_id))
  const keystoneIds = new Set((keystones ?? []).map(k => k.habit_id))
  const loggedIds   = new Set((logs ?? []).map(l => l.habit_id))

  const pending: ReminderHabit[] = (habits ?? [])
    .filter(h => !(h.is_global && hiddenIds.has(h.id)) && !loggedIds.has(h.id))
    .map(h => ({
      id:           h.id,
      habit_name:   h.habit_name,
      // Global habits share one row across users, so they carry no per-user streak.
      streak_count: h.is_global ? 0 : h.streak_count,
      is_keystone:  h.is_global ? keystoneIds.has(h.id) : h.is_keystone,
      streakAlive:  !h.is_global && h.streak_count > 0 && !!h.last_done_at
        && lastDoneLocalDate(h.last_done_at, timezone) === yesterday,
      leverage:     leverage.get(h.id) ?? null,
    }))

  const perfectAlive = rewards?.last_perfect_date === yesterday || rewards?.last_perfect_date === today
  return {
    pending,
    doneCount:     (logs ?? []).filter(l => l.status === 'done').length,
    perfectStreak: perfectAlive ? rewards?.current_perfect_streak ?? 0 : 0,
    powerDone,
    // One line per reminder: the first due exercise (reviews before the program).
    exerciseDue:   workbookStatus(workbookRows ?? [], today).due[0]?.title ?? null,
  }
}

async function sendPush(admin: AdminClient, userId: string, msg: ReminderMessage): Promise<void> {
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth_key')
    .eq('user_id', userId)
  if (!subs?.length) return

  // Consumed by public/sw.js — `habitId` powers the one-tap "mark done" action.
  const payload = JSON.stringify({
    title:     msg.title,
    body:      msg.body,
    url:       msg.url,
    tag:       msg.tag,
    habitId:   msg.actionHabit?.id,
    habitName: msg.actionHabit?.name,
  })

  const expired: string[] = []
  await Promise.allSettled(subs.map(sub =>
    webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
      payload,
    ).catch((err: { statusCode?: number }) => {
      // 404/410: the subscription is gone for good. Anything else may be transient.
      if (err?.statusCode === 404 || err?.statusCode === 410) expired.push(sub.endpoint)
    })
  ))
  if (expired.length) await admin.from('push_subscriptions').delete().in('endpoint', expired)
}

function telegramText(msg: ReminderMessage, appUrl: string): string {
  return [`<b>${msg.title}</b>`, '', msg.body, '', `<a href="${appUrl}${msg.url}">Open Zenith →</a>`].join('\n')
}

function emailHtml(greeting: string, message: string, appUrl: string, url: string) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:40px 20px}
  .wrap{max-width:480px;margin:0 auto}
  .logo{text-align:center;font-size:22px;font-weight:700;color:#fff;margin-bottom:32px}
  .logo span{color:#a78bfa}
  .card{background:#1e293b;border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:28px;margin-bottom:16px}
  h2{font-size:18px;font-weight:600;color:#fff;margin:0 0 10px}
  p{font-size:14px;color:#94a3b8;line-height:1.6;margin:0}
  .cta{display:block;text-align:center;background:#7c3aed;color:#fff!important;text-decoration:none;padding:14px 24px;border-radius:10px;font-weight:600;font-size:15px;margin-top:24px}
  .footer{text-align:center;margin-top:28px;font-size:12px;color:#475569}
  .footer a{color:#475569}
</style>
</head>
<body>
  <div class="wrap">
    <div class="logo">Zenith</div>
    <div class="card">
      <h2>${greeting}</h2>
      <p>${message}</p>
    </div>
    <a href="${appUrl}${url}" class="cta">Open Zenith</a>
    <div class="footer">
      Zenith &nbsp;·&nbsp;
      <a href="${appUrl}/settings">Manage notifications</a>
    </div>
  </div>
</body>
</html>`
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  // Accept the cron secret OR a valid logged-in session (for manual testing).
  // A session only ever processes that user's own reminders.
  let onlyUserId: string | null = null
  if (!(cronSecret && auth === `Bearer ${cronSecret}`)) {
    const { data: { user } } = await createSupabaseServerClient().auth.getUser()
    if (!user && cronSecret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    onlyUserId = user?.id ?? null
  }

  if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT ?? `mailto:admin@${new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://growthos.app').hostname}`,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY,
    )
  }
  const pushReady = !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)

  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
  const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://growthos.app'
  const admin  = createSupabaseAdminClient()

  let query = admin
    .from('notification_settings')
    .select('user_id, push_enabled, email_enabled, call_enabled, phone_number, telegram_enabled, telegram_chat_id, reminder_times, sent_today, timezone')
    .or('push_enabled.eq.true,email_enabled.eq.true,call_enabled.eq.true,telegram_enabled.eq.true')
  if (onlyUserId) query = query.eq('user_id', onlyUserId)
  const { data: settings, error: settingsError } = await query
  if (settingsError) return NextResponse.json({ error: settingsError.message }, { status: 500 })

  let processed = 0

  for (const s of settings ?? []) {
    const tz  = s.timezone ?? 'UTC'
    const now = localNow(tz)
    const sentToday: Record<string, string> = s.sent_today ?? {}

    const due = dueReminderTimes(s.reminder_times ?? ['08:00', '18:00'], sentToday, now)
    // The streak nudge only goes to instant channels — an email or a phone
    // call at 9 PM about one habit is more intrusive than it's worth.
    const nudgeDue = (s.push_enabled || s.telegram_enabled)
      && dueReminderTimes([STREAK_RISK_TIME], { [STREAK_RISK_TIME]: sentToday[STREAK_RISK_KEY] ?? '' }, now)[0]
    if (!due.length && !nudgeDue) continue

    // Habit state is for the day the reminder belongs to (normally today).
    const day       = due[0]?.date ?? (nudgeDue ? nudgeDue.date : now.dateStr)
    const dayBefore = prevDate(day)
    const state     = await loadHabitState(admin, s.user_id, tz, day, dayBefore)

    const updatedSent = { ...sentToday }

    if (due.length) {
      const { data: todos } = await admin
        .from('user_todos')
        .select('title')
        .eq('user_id', s.user_id)
        .eq('is_completed', false)
        .lte('due_date', day)
        .order('due_date', { ascending: true })
        .limit(10)

      const isEvening = now.minutes >= 12 * 60
      // Several due at once (e.g. after a scheduler outage) collapse into one message.
      const msg = buildReminder({
        pending:       state.pending,
        doneCount:     state.doneCount,
        todoTitles:    (todos ?? []).map(t => t.title as string),
        isEvening,
        perfectStreak: state.perfectStreak,
        powerPending:  !state.powerDone.has(isEvening ? POWER_TAG.evening : POWER_TAG.morning),
        exerciseDue:   state.exerciseDue,
      })

      if (s.push_enabled && pushReady) await sendPush(admin, s.user_id, msg)

      if (s.email_enabled && resend) {
        const { data: authUser } = await admin.auth.admin.getUserById(s.user_id)
        const email = authUser?.user?.email
        if (email) {
          await resend.emails.send({
            from:    process.env.RESEND_FROM_EMAIL ?? 'Zenith <onboarding@resend.dev>',
            to:      email,
            subject: msg.title,
            html:    emailHtml(isEvening ? 'Good evening! 🌙' : 'Good morning! 🌅', msg.body, appUrl, msg.url),
          }).catch(() => {})
        }
      }

      if (s.call_enabled && s.phone_number && twilioClient && process.env.TWILIO_FROM_NUMBER) {
        const spoken  = `${msg.title}. ${msg.body}`.replace(/[^\w\s.,:;!?'+-]/g, '')
        const callUrl = `${appUrl}/api/voice/reminder?msg=${encodeURIComponent(spoken)}`
        await twilioClient.calls.create({
          to:   s.phone_number,
          from: process.env.TWILIO_FROM_NUMBER,
          url:  callUrl,
        }).catch((err: unknown) => {
          console.error('[cron/reminders] Twilio call failed for user', s.user_id, (err as Error)?.message ?? err)
        })
      }

      if (s.telegram_enabled && s.telegram_chat_id) {
        await sendTelegramMessage(s.telegram_chat_id, telegramText(msg, appUrl))
      }

      due.forEach(d => { updatedSent[d.time] = d.date })
    }

    // Skipped when a regular reminder just went out — one notification per run.
    if (nudgeDue && !due.length) {
      const nudge = buildStreakRiskNudge(state.pending)
      if (nudge) {
        if (s.push_enabled && pushReady) await sendPush(admin, s.user_id, nudge)
        if (s.telegram_enabled && s.telegram_chat_id) {
          await sendTelegramMessage(s.telegram_chat_id, telegramText(nudge, appUrl))
        }
      }
      // Marked handled even when nothing was at stake, so it isn't re-evaluated all hour.
      updatedSent[STREAK_RISK_KEY] = nudgeDue.date
    }

    await admin
      .from('notification_settings')
      .update({ sent_today: updatedSent, updated_at: new Date().toISOString() })
      .eq('user_id', s.user_id)

    processed++
  }

  return NextResponse.json({ ok: true, processed })
}
