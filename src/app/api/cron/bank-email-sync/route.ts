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

  // Optional one-time backfill: ?days=14 searches Gmail that far back regardless
  // of last_synced_at, instead of the normal incremental since-last-run window.
  // Safe to re-run — the (user_id, external_id) unique index no-ops already-imported emails.
  const daysParam = req.nextUrl.searchParams.get('days')
  const sinceOverrideEpoch = daysParam
    ? Math.floor(Date.now() / 1000) - Number(daysParam) * 86400
    : undefined

  const result = await runBankEmailSync(createSupabaseAdminClient(), sinceOverrideEpoch)
  return NextResponse.json({ ok: true, ...result })
}
