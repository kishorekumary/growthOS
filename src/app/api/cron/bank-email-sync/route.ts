import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { runBankEmailSync } from '@/lib/bank-email-sync'

// Not scheduled directly in vercel.json — Vercel Hobby caps projects at 2 cron
// jobs run at most once a day. This runs as part of /api/cron/daily-habit-close
// instead; this route stays around for manual testing (Bearer CRON_SECRET or a
// logged-in session).
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  let authorized = !cronSecret || auth === `Bearer ${cronSecret}`
  if (!authorized) {
    const { data: { user } } = await createSupabaseServerClient().auth.getUser()
    authorized = !!user
  }
  if (!authorized) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await runBankEmailSync(createSupabaseAdminClient())
  return NextResponse.json({ ok: true, ...result })
}
