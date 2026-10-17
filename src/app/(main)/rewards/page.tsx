import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import RewardsClient from './RewardsClient'

export default async function RewardsPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: rewards }, { data: catalog }, { data: redemptions }, { data: habits }, freezeRes, spendRes, redeemedSpendRes] = await Promise.all([
    supabase.from('user_rewards')
      .select('points_balance, current_perfect_streak, longest_perfect_streak')
      .eq('user_id', user.id).maybeSingle(),
    supabase.from('reward_catalog')
      .select('id, title, point_cost, created_at')
      .eq('user_id', user.id).order('point_cost', { ascending: true }),
    supabase.from('reward_redemptions')
      .select('id, title, point_cost, redeemed_at')
      .eq('user_id', user.id).order('redeemed_at', { ascending: false }).limit(20),
    supabase.from('personality_habits')
      .select('id, habit_name, streak_count, is_global')
      .or(`user_id.eq.${user.id},is_global.eq.true`)
      .gt('streak_count', 0)
      .order('streak_count', { ascending: false }),
    // Separate query: errors (hiding the freeze shop) until migration 049 is applied.
    supabase.from('user_rewards').select('streak_freezes').eq('user_id', user.id).maybeSingle(),
    // Separate queries: error (hiding money amounts) until migration 054 is applied.
    supabase.from('reward_catalog').select('id, spend_amount').eq('user_id', user.id),
    supabase.from('reward_redemptions').select('id, spend_amount')
      .eq('user_id', user.id).order('redeemed_at', { ascending: false }).limit(20),
  ])
  const amounts = (rows: { id: string; spend_amount: number | string | null }[] | null) =>
    Object.fromEntries((rows ?? []).map(r => [r.id, r.spend_amount === null ? null : Number(r.spend_amount)]))

  return (
    <RewardsClient
      pointsBalance={rewards?.points_balance ?? 0}
      currentPerfectStreak={rewards?.current_perfect_streak ?? 0}
      longestPerfectStreak={rewards?.longest_perfect_streak ?? 0}
      catalog={catalog ?? []}
      redemptions={redemptions ?? []}
      streaks={(habits ?? []).filter(h => !h.is_global)}
      streakFreezes={freezeRes.error ? null : freezeRes.data?.streak_freezes ?? 0}
      spendAmounts={spendRes.error ? null : amounts(spendRes.data)}
      redemptionSpend={redeemedSpendRes.error ? {} : amounts(redeemedSpendRes.data)}
    />
  )
}
