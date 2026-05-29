import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'

type Role = 'user' | 'admin' | 'superadmin'

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: caller } = await supabase
    .from('user_profiles')
    .select('is_admin, is_superadmin')
    .eq('id', user.id)
    .single()

  if (!caller?.is_admin && !caller?.is_superadmin)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId, role } = await req.json() as { userId: string; role: Role }
  if (!userId || !role) return NextResponse.json({ error: 'userId and role required' }, { status: 400 })

  // Only superadmins can assign the superadmin role
  if (role === 'superadmin' && !caller.is_superadmin)
    return NextResponse.json({ error: 'Only superadmins can assign superadmin role' }, { status: 403 })

  const update = {
    is_admin:      role === 'admin' || role === 'superadmin',
    is_superadmin: role === 'superadmin',
  }

  const admin = createSupabaseAdminClient()
  const { error } = await admin.from('user_profiles').update(update).eq('id', userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
