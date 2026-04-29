import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import webpush from 'web-push'
import { Resend } from 'resend'

// Returns current local time and date string in the given IANA timezone
function localTime(timezone: string): { h: number; m: number; dateStr: string } {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
  const parts = Object.fromEntries(formatter.formatToParts(now).map(p => [p.type, p.value]))
  return {
    h: parseInt(parts.hour ?? '0'),
    m: parseInt(parts.minute ?? '0'),
    dateStr: `${parts.year}-${parts.month}-${parts.day}`,
  }
}

// True if the configured reminder time falls within the current 60-minute window.
// Designed for hourly cron calls — each time is catchable within ±0-59 minutes.
function isDue(reminderTime: string, timezone: string): boolean {
  const [rh, rm] = reminderTime.split(':').map(Number)
  const { h, m } = localTime(timezone)
  const reminderMins = rh * 60 + rm
  const currentMins  = h * 60 + m
  return currentMins >= reminderMins && currentMins < reminderMins + 60
}

function emailHtml(greeting: string, message: string, appUrl: string) {
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
    <div class="logo">Growth<span>OS</span></div>
    <div class="card">
      <h2>${greeting}</h2>
      <p>${message}</p>
    </div>
    <a href="${appUrl}/todos" class="cta">Open My Tasks</a>
    <div class="footer">
      GrowthOS &nbsp;·&nbsp;
      <a href="${appUrl}/settings">Manage notifications</a>
    </div>
  </div>
</body>
</html>`
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT ?? 'mailto:admin@growthos.app',
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY,
    )
  }

  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://growthos.app'
  const admin  = createSupabaseAdminClient()

  const { data: settings } = await admin
    .from('notification_settings')
    .select('user_id, push_enabled, email_enabled, reminder_times, sent_today, timezone')
    .or('push_enabled.eq.true,email_enabled.eq.true')

  if (!settings?.length) return NextResponse.json({ ok: true, processed: 0 })

  let processed = 0

  for (const s of settings) {
    const tz = s.timezone ?? 'UTC'
    const { h, dateStr } = localTime(tz)

    // Find which configured times are due now and haven't been sent yet today
    const reminderTimes: string[] = s.reminder_times ?? ['08:00', '18:00']
    const sentToday: Record<string, string> = s.sent_today ?? {}

    const dueTimes = reminderTimes.filter(t =>
      isDue(t, tz) && sentToday[t] !== dateStr
    )

    if (!dueTimes.length) continue

    const isEvening = h >= 12
    const greeting  = isEvening ? 'Good evening! 🌙' : 'Good morning! 🌅'

    const { count: todoCount } = await admin
      .from('user_todos')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', s.user_id)
      .eq('is_completed', false)
      .lte('due_date', dateStr)

    const taskMsg = (todoCount ?? 0) > 0
      ? `You have ${todoCount} task${todoCount !== 1 ? 's' : ''} pending today. Stay on track!`
      : 'Your tasks are clear today. Keep the momentum going!'

    const pushPayload = JSON.stringify({
      title: 'GrowthOS Reminder 🌱',
      body:  taskMsg,
      url:   '/todos',
    })

    if (s.push_enabled && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
      const { data: subs } = await admin
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth_key')
        .eq('user_id', s.user_id)

      if (subs?.length) {
        await Promise.allSettled(
          subs.map(sub =>
            webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
              pushPayload
            ).catch(() => {
              admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
            })
          )
        )
      }
    }

    if (s.email_enabled && resend) {
      const { data: authUser } = await admin.auth.admin.getUserById(s.user_id)
      const email = authUser?.user?.email
      if (email) {
        await resend.emails.send({
          from:    process.env.RESEND_FROM_EMAIL ?? 'GrowthOS <onboarding@resend.dev>',
          to:      email,
          subject: isEvening ? 'Your GrowthOS Evening Check-In' : 'Your GrowthOS Morning Reminder',
          html:    emailHtml(greeting, taskMsg, appUrl),
        }).catch(() => {})
      }
    }

    // Mark each fired time as sent today
    const updatedSentToday = { ...sentToday }
    dueTimes.forEach(t => { updatedSentToday[t] = dateStr })

    await admin
      .from('notification_settings')
      .update({ sent_today: updatedSentToday, updated_at: new Date().toISOString() })
      .eq('user_id', s.user_id)

    processed++
  }

  return NextResponse.json({ ok: true, processed })
}
