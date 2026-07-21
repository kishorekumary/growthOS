import type { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { refreshAccessToken, searchAxisAlerts, fetchMessageBody, parseAxisAlert } from '@/lib/gmail'

const DEFAULT_LOOKBACK_SECONDS = 60 * 60 * 24 // 24h on first run

export async function runBankEmailSync(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  sinceOverrideEpoch?: number
) {
  const { data: connections } = await admin
    .from('bank_email_connections')
    .select('user_id, refresh_token, last_synced_at')
    .eq('sync_enabled', true)

  let processed = 0
  let imported  = 0

  for (const conn of connections ?? []) {
    try {
      const accessToken = await refreshAccessToken(conn.refresh_token)
      const sinceEpoch = sinceOverrideEpoch ?? (conn.last_synced_at
        ? Math.floor(new Date(conn.last_synced_at).getTime() / 1000)
        : Math.floor(Date.now() / 1000) - DEFAULT_LOOKBACK_SECONDS)

      const messageIds = await searchAxisAlerts(accessToken, sinceEpoch)

      for (const id of messageIds) {
        const body   = await fetchMessageBody(accessToken, id)
        const parsed = parseAxisAlert(body)
        if (!parsed) continue

        const { error } = await admin.from('transactions').insert({
          user_id:     conn.user_id,
          txn_date:    parsed.txnDate,
          type:        parsed.type,
          category:    'Uncategorized',
          amount:      parsed.amount,
          description: parsed.description,
          source:      'axis_email',
          external_id: id,
        })
        // Unique index on (user_id, external_id) makes re-processing a safe no-op
        if (!error) imported++
      }

      await admin
        .from('bank_email_connections')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('user_id', conn.user_id)

      processed++
    } catch (err) {
      console.error('[bank-email-sync] failed for user', conn.user_id, (err as Error)?.message ?? err)
    }
  }

  return { processed, imported }
}
