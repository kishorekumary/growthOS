import type { createSupabaseServerClient } from '@/lib/supabase-server'

type SupabaseClient = ReturnType<typeof createSupabaseServerClient>

// Returns whether the points actually landed (both the log insert and the
// balance RPC succeeded). Callers must not tell the client a milestone was
// awarded — or persist any "already awarded" marker — when this is false.
export async function awardPoints(supabase: SupabaseClient, userId: string, delta: number, reason: string): Promise<boolean> {
  const { error: logError } = await supabase.from('reward_points_log').insert({ user_id: userId, delta, reason })
  if (logError) {
    console.error('awardPoints: failed to insert reward_points_log', { userId, delta, reason, error: logError })
    return false
  }
  const { error: rpcError } = await supabase.rpc('increment_points_balance', { p_user_id: userId, p_delta: delta })
  if (rpcError) {
    console.error('awardPoints: increment_points_balance RPC failed', { userId, delta, reason, error: rpcError })
    return false
  }
  return true
}
