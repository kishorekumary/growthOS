import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const telegramToken = process.env.TELEGRAM_BOT_TOKEN
  const vapidPublic   = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const vapidPrivate  = process.env.VAPID_PRIVATE_KEY
  const resendKey     = process.env.RESEND_API_KEY
  const resendFrom    = process.env.RESEND_FROM_EMAIL
  const cronSecret    = process.env.CRON_SECRET
  const twilioSid     = process.env.TWILIO_ACCOUNT_SID
  const twilioToken   = process.env.TWILIO_AUTH_TOKEN

  return NextResponse.json({
    push: {
      ok: !!(vapidPublic && vapidPrivate),
      detail: vapidPublic && vapidPrivate ? 'VAPID keys configured' : 'VAPID keys missing — push will not work',
    },
    email: {
      ok: !!resendKey,
      detail: !resendKey
        ? 'RESEND_API_KEY not set'
        : resendFrom
        ? `Sending from: ${resendFrom}`
        : 'RESEND_FROM_EMAIL not set — using Resend sandbox (onboarding@resend.dev). Add a verified domain to send to any email.',
    },
    telegram: {
      ok: !!(telegramToken && telegramToken.length > 10),
      detail: (telegramToken && telegramToken.length > 10)
        ? 'TELEGRAM_BOT_TOKEN is set'
        : 'TELEGRAM_BOT_TOKEN is not set. Create a bot via @BotFather on Telegram, then add the token to your environment variables.',
    },
    cron: {
      ok: !!(cronSecret && cronSecret !== 'your-cron-secret'),
      detail: !cronSecret
        ? 'CRON_SECRET not set — reminders will not fire automatically'
        : cronSecret === 'your-cron-secret'
        ? 'CRON_SECRET is still the placeholder value. Set a real secret and update your Vercel cron configuration.'
        : 'CRON_SECRET configured',
    },
    phone: {
      ok: !!(twilioSid && twilioToken),
      detail: (twilioSid && twilioToken) ? 'Twilio credentials configured' : 'Twilio not configured',
    },
  })
}
