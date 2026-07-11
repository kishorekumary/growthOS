import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'

export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createSupabaseAdminClient()
  const { data } = await admin
    .from('bank_email_connections')
    .select('gmail_email, sync_enabled, last_synced_at, created_at')
    .eq('user_id', user.id)
    .maybeSingle()

  // Google expires the Gmail refresh token after 7 days for unverified apps in
  // Testing mode, so the daily sync can silently stop. Flag it stale once the
  // last successful sync (or the initial connection, if it never synced) is
  // more than 2 days old — well past the once-a-day cadence — so the UI can
  // prompt a reconnect instead of quietly missing transactions.
  const STALE_AFTER_MS = 1000 * 60 * 60 * 24 * 2
  const referenceTime = data?.last_synced_at ?? data?.created_at ?? null
  const stale = !!data && !!referenceTime && (Date.now() - new Date(referenceTime).getTime()) > STALE_AFTER_MS

  return NextResponse.json({
    connected:     !!data,
    gmailEmail:    data?.gmail_email ?? null,
    syncEnabled:   data?.sync_enabled ?? false,
    lastSyncedAt:  data?.last_synced_at ?? null,
    stale,
  })
}
