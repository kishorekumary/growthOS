import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { sendTelegramMessage } from '@/lib/telegram'

export async function POST() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('notification_settings')
    .select('telegram_chat_id')
    .eq('user_id', user.id)
    .maybeSingle()

  const chatId = data?.telegram_chat_id
  if (!chatId) return NextResponse.json({ error: 'No Telegram chat ID saved. Save your settings first.' }, { status: 400 })

  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN is not set on the server.' }, { status: 500 })
  }

  const ok = await sendTelegramMessage(chatId, [
    '🌱 <b>GrowthOS Test</b>',
    '',
    'Telegram notifications are working! You will receive reminders here at your configured times.',
  ].join('\n'))

  if (!ok) return NextResponse.json({ error: 'Failed to send message. Check your Chat ID and bot token.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
