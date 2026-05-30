import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

async function requireAdmin() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401, supabase: null }
  const { data: profile } = await supabase.from('user_profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return { error: 'Forbidden', status: 403, supabase: null }
  return { error: null, status: 200, supabase }
}

// PATCH /api/admin/global-books?id=<uuid>&global=true|false
export async function PATCH(req: Request) {
  const { error, status, supabase } = await requireAdmin()
  if (error || !supabase) return NextResponse.json({ error }, { status })

  const { searchParams } = new URL(req.url)
  const id       = searchParams.get('id')
  const isGlobal = searchParams.get('global') === 'true'
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error: dbErr } = await supabase
    .from('reading_log')
    .update({ is_global: isGlobal })
    .eq('id', id)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ ok: true, is_global: isGlobal })
}
