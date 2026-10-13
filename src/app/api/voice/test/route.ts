import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import twilio from 'twilio'
import { fetchReminderTitles } from '@/lib/planner/actions'

export async function POST() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null
  if (!twilioClient || !process.env.TWILIO_FROM_NUMBER) {
    return NextResponse.json({ error: 'Twilio is not configured' }, { status: 503 })
  }

  const { data: settings } = await supabase
    .from('notification_settings')
    .select('phone_number')
    .eq('user_id', user.id)
    .maybeSingle()

  const phoneNumber = settings?.phone_number
  if (!phoneNumber) {
    return NextResponse.json({ error: 'No phone number saved. Add one in notification settings.' }, { status: 400 })
  }

  const today = new Date().toISOString().slice(0, 10)
  const todoTitles = await fetchReminderTitles(supabase, user.id, today)

  const todoCount = todoTitles.length
  let taskMsg: string
  if (todoCount === 0) {
    taskMsg = 'Your tasks are clear today. Keep the momentum going!'
  } else if (todoCount === 1) {
    taskMsg = `You have 1 task pending today: ${todoTitles[0]}. Stay on track!`
  } else {
    const spoken = todoTitles.slice(0, 5)
      .map((t, i) => `${i + 1}. ${t}`)
      .join('. ')
    const remaining = todoCount > 5 ? ` And ${todoCount - 5} more.` : ''
    taskMsg = `You have ${todoCount} tasks pending today. Here they are: ${spoken}.${remaining} Stay on track!`
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://growthos.app'
  const callUrl = `${appUrl}/api/voice/reminder?msg=${encodeURIComponent(taskMsg)}`

  try {
    const call = await twilioClient.calls.create({
      to:   phoneNumber,
      from: process.env.TWILIO_FROM_NUMBER,
      url:  callUrl,
    })
    return NextResponse.json({ ok: true, sid: call.sid })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message ?? 'Call failed' }, { status: 500 })
  }
}
