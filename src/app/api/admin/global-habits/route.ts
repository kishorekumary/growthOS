import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

async function requireAdmin() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401, supabase: null, user: null }
  const { data: profile } = await supabase.from('user_profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return { error: 'Forbidden', status: 403, supabase: null, user: null }
  return { error: null, status: 200, supabase, user }
}

// Create a global habit
export async function POST(req: Request) {
  const { error, status, supabase, user } = await requireAdmin()
  if (error || !supabase || !user) return NextResponse.json({ error }, { status })

  const { habit_name, category, frequency, description } = await req.json()
  if (!habit_name?.trim()) return NextResponse.json({ error: 'habit_name required' }, { status: 400 })

  const { data, error: dbErr } = await supabase.from('personality_habits').insert({
    user_id: user.id,
    habit_name: habit_name.trim(),
    category: category ?? 'mindset',
    frequency: frequency ?? 'daily',
    description: description ?? null,
    is_global: true,
  }).select().single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ habit: data })
}

// Delete a global habit
export async function DELETE(req: Request) {
  const { error, status, supabase } = await requireAdmin()
  if (error || !supabase) return NextResponse.json({ error }, { status })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error: dbErr } = await supabase
    .from('personality_habits')
    .delete()
    .eq('id', id)
    .eq('is_global', true)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
