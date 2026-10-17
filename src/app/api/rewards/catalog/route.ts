import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// Optional money allowance (migration 054). Only written when the client
// sends the key — the form only offers it once the column exists.
function spendField(body: { spend_amount?: unknown }): { spend_amount?: number | null } | { error: string } {
  if (!('spend_amount' in body)) return {}
  const v = body.spend_amount
  if (v === null) return { spend_amount: null }
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return { spend_amount: Math.round(v * 100) / 100 }
  return { error: 'spend_amount must be a positive number or null' }
}

async function requireUser() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401, supabase: null, user: null }
  return { error: null, status: 200, supabase, user }
}

export async function POST(req: Request) {
  const { error, status, supabase, user } = await requireUser()
  if (error || !supabase || !user) return NextResponse.json({ error }, { status })

  const body = await req.json()
  const { title, point_cost } = body
  if (!title?.trim() || !point_cost || point_cost <= 0) {
    return NextResponse.json({ error: 'title and a positive point_cost are required' }, { status: 400 })
  }
  const spend = spendField(body)
  if ('error' in spend) return NextResponse.json({ error: spend.error }, { status: 400 })

  const { data, error: dbErr } = await supabase.from('reward_catalog').insert({
    user_id:    user.id,
    title:      title.trim(),
    point_cost: Math.round(point_cost),
    ...spend,
  }).select().single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ reward: data })
}

export async function PATCH(req: Request) {
  const { error, status, supabase, user } = await requireUser()
  if (error || !supabase || !user) return NextResponse.json({ error }, { status })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const body = await req.json()
  const { title, point_cost } = body
  if (!title?.trim() || !point_cost || point_cost <= 0) {
    return NextResponse.json({ error: 'title and a positive point_cost are required' }, { status: 400 })
  }
  const spend = spendField(body)
  if ('error' in spend) return NextResponse.json({ error: spend.error }, { status: 400 })

  const { data, error: dbErr } = await supabase
    .from('reward_catalog')
    .update({ title: title.trim(), point_cost: Math.round(point_cost), ...spend })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ reward: data })
}

export async function DELETE(req: Request) {
  const { error, status, supabase, user } = await requireUser()
  if (error || !supabase || !user) return NextResponse.json({ error }, { status })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error: dbErr } = await supabase
    .from('reward_catalog')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
