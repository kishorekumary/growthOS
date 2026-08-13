import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

async function requireUser() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401, supabase: null, user: null }
  return { error: null, status: 200, supabase, user }
}

export async function POST(req: Request) {
  const { error, status, supabase, user } = await requireUser()
  if (error || !supabase || !user) return NextResponse.json({ error }, { status })

  const { title, point_cost } = await req.json()
  if (!title?.trim() || !point_cost || point_cost <= 0) {
    return NextResponse.json({ error: 'title and a positive point_cost are required' }, { status: 400 })
  }

  const { data, error: dbErr } = await supabase.from('reward_catalog').insert({
    user_id:    user.id,
    title:      title.trim(),
    point_cost: Math.round(point_cost),
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

  const { title, point_cost } = await req.json()
  if (!title?.trim() || !point_cost || point_cost <= 0) {
    return NextResponse.json({ error: 'title and a positive point_cost are required' }, { status: 400 })
  }

  const { data, error: dbErr } = await supabase
    .from('reward_catalog')
    .update({ title: title.trim(), point_cost: Math.round(point_cost) })
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
