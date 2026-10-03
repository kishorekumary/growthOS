import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { FREEZE_COST, FREEZE_MAX } from '@/lib/dailyChest'

// Buys one streak freeze with points. The RPC checks balance and the
// FREEZE_MAX cap and applies both changes atomically.
export async function POST() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: bought, error } = await supabase.rpc('buy_streak_freeze', {
    p_user_id: user.id, p_cost: FREEZE_COST, p_max: FREEZE_MAX,
  })
  if (error) {
    console.error('POST /api/rewards/buy-freeze: RPC failed', error)
    return NextResponse.json({ error: 'Streak freezes are not available yet' }, { status: 500 })
  }
  if (!bought) {
    return NextResponse.json({
      error: `Need ${FREEZE_COST} points and fewer than ${FREEZE_MAX} freezes held`,
    }, { status: 409 })
  }

  const { error: logErr } = await supabase.from('reward_points_log')
    .insert({ user_id: user.id, delta: -FREEZE_COST, reason: 'Bought: streak freeze' })
  if (logErr) console.error('POST /api/rewards/buy-freeze: points log insert failed', logErr)

  return NextResponse.json({ ok: true })
}
