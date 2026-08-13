import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { catalog_id } = await req.json()
  if (!catalog_id) return NextResponse.json({ error: 'catalog_id required' }, { status: 400 })

  const { data: item, error: itemErr } = await supabase
    .from('reward_catalog')
    .select('id, title, point_cost')
    .eq('id', catalog_id)
    .eq('user_id', user.id)
    .single()
  if (itemErr || !item) return NextResponse.json({ error: 'Reward not found' }, { status: 404 })

  const { data: rewards } = await supabase
    .from('user_rewards')
    .select('points_balance')
    .eq('user_id', user.id)
    .single()
  if (!rewards || rewards.points_balance < item.point_cost) {
    return NextResponse.json({ error: 'Not enough points' }, { status: 400 })
  }

  const { error: deductErr } = await supabase.rpc('increment_points_balance', {
    p_user_id: user.id,
    p_delta:   -item.point_cost,
  })
  if (deductErr) return NextResponse.json({ error: deductErr.message }, { status: 500 })

  await supabase.from('reward_points_log').insert({
    user_id: user.id, delta: -item.point_cost, reason: `Redeemed: ${item.title}`,
  })
  const { data: redemption } = await supabase.from('reward_redemptions').insert({
    user_id: user.id, title: item.title, point_cost: item.point_cost,
  }).select().single()

  return NextResponse.json({ redemption })
}
