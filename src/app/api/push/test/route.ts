import { NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import webpush from 'web-push'

export async function POST() {
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 500 })
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:admin@growthos.app',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )

  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cs: { name: string; value: string; options: CookieOptions }[]) {
          cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth_key')
    .eq('user_id', user.id)

  if (!subs?.length) {
    return NextResponse.json({ error: 'No push subscriptions found for this account' }, { status: 404 })
  }

  const payload = JSON.stringify({
    title: 'GrowthOS Test 🌱',
    body:  'Push notifications are working!',
    url:   '/todos',
  })

  const results = await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
        payload
      )
    )
  )

  const failed = results.filter(r => r.status === 'rejected')
  if (failed.length === subs.length) {
    return NextResponse.json({ error: 'All push notifications failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, sent: subs.length - failed.length })
}
