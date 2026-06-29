import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import webpush from 'web-push'

export async function POST(req: NextRequest) {
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    // VAPID not configured — fail silently so the timer still works
    return NextResponse.json({ ok: true, sent: 0, reason: 'vapid_not_configured' })
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? `mailto:admin@${new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://growthos.app').hostname}`,
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

  const { title, body, url } = await req.json() as { title: string; body: string; url?: string }
  if (!title || !body) return NextResponse.json({ error: 'Missing title or body' }, { status: 400 })

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth_key')
    .eq('user_id', user.id)

  if (!subs?.length) return NextResponse.json({ ok: true, sent: 0 })

  const payload = JSON.stringify({ title, body, url: url ?? '/focus' })
  const expiredEndpoints: string[] = []

  const results = await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
        payload
      ).catch((err: { statusCode?: number }) => {
        // 404/410 means subscription is gone — collect for cleanup
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          expiredEndpoints.push(sub.endpoint)
        }
        throw err
      })
    )
  )

  // Clean up expired subscriptions
  if (expiredEndpoints.length) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', user.id)
      .in('endpoint', expiredEndpoints)
  }

  const sent = results.filter(r => r.status === 'fulfilled').length
  return NextResponse.json({ ok: true, sent })
}
