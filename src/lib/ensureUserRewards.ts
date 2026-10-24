import type { SupabaseClient } from '@supabase/supabase-js'

// Makes sure the user's user_rewards row exists before points are awarded —
// increment_points_balance is an UPDATE, so with no row it silently moves
// nothing. Prefers the ensure_user_rewards() RPC (migration 058), which works
// even where RLS blocks users inserting into user_rewards; falls back to the
// plain upsert when that migration isn't applied yet. Returns whether the
// row is now known to exist.
export async function ensureUserRewards(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { error: rpcError } = await supabase.rpc('ensure_user_rewards')
  if (!rpcError) return true
  const { error } = await supabase.from('user_rewards').upsert(
    { user_id: userId },
    { onConflict: 'user_id', ignoreDuplicates: true }
  )
  if (error) console.error('ensureUserRewards: could not create user_rewards row', { userId, rpcError, error })
  return !error
}
