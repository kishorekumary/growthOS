import type { SupabaseClient } from '@supabase/supabase-js'
import type { ActivityEvent } from './activity'

// Recent activity events across the app, newest per source, for one user or
// everyone. Server-only: pass the service-role (admin) client. A source
// whose query fails (e.g. a table not migrated yet) is simply skipped.
const SOURCES: { table: string; at: string; label: (r: Record<string, unknown>) => string }[] = [
  { table: 'reward_points_log', at: 'created_at', label: r => String(r.reason ?? 'Earned points') },
  { table: 'habit_logs',        at: 'created_at', label: r => r.status === 'done' ? 'Checked off a habit' : 'Updated a habit' },
  { table: 'nutrition_logs',    at: 'created_at', label: r => r.food_name ? `Logged a meal: ${r.food_name}` : 'Logged a meal' },
  { table: 'workout_logs',      at: 'created_at', label: r => r.workout_type ? `Logged a workout: ${r.workout_type}` : 'Logged a workout' },
  { table: 'transactions',      at: 'created_at', label: r => r.description ? `Added a transaction: ${r.description}` : 'Added a transaction' },
  { table: 'journal_entries',   at: 'created_at', label: () => 'Wrote in their journal' },
  { table: 'mood_checkins',     at: 'created_at', label: () => 'Did a mood check-in' },
  { table: 'sleep_logs',        at: 'created_at', label: () => 'Logged sleep' },
  { table: 'water_logs',        at: 'logged_at',  label: () => 'Logged water' },
]

const EXTRA_COLS: Record<string, string> = {
  reward_points_log: ', reason', habit_logs: ', status', nutrition_logs: ', food_name',
  workout_logs: ', workout_type', transactions: ', description',
}

export async function loadActivity(
  admin: SupabaseClient, opts: { userId?: string; days?: number; perSource?: number } = {},
): Promise<ActivityEvent[]> {
  const since = new Date(Date.now() - (opts.days ?? 90) * 86_400_000).toISOString()
  const results = await Promise.all(SOURCES.map(async s => {
    let q = admin.from(s.table).select(`user_id, ${s.at}${EXTRA_COLS[s.table] ?? ''}`)
      .gte(s.at, since).order(s.at, { ascending: false }).limit(opts.perSource ?? 1000)
    if (opts.userId) q = q.eq('user_id', opts.userId)
    const { data, error } = await q
    if (error || !data) return []
    return (data as unknown as Record<string, unknown>[]).map(r => ({
      user_id: String(r.user_id), at: String(r[s.at]), label: s.label(r),
    }))
  }))
  return results.flat()
}
