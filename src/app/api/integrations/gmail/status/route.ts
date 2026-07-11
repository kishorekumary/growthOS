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
    .select('gmail_email, sync_enabled, last_synced_at')
    .eq('user_id', user.id)
    .maybeSingle()

  return NextResponse.json({
    connected:     !!data,
    gmailEmail:    data?.gmail_email ?? null,
    syncEnabled:   data?.sync_enabled ?? false,
    lastSyncedAt:  data?.last_synced_at ?? null,
  })
}
