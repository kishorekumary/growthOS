import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify caller is admin
  const { data: caller } = await supabase
    .from('user_profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (!caller?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId, is_admin } = await req.json() as { userId: string; is_admin: boolean }
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  // Use service role to bypass RLS for the is_admin write
  const admin = createSupabaseAdminClient()
  const { error } = await admin
    .from('user_profiles')
    .update({ is_admin })
    .eq('id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
