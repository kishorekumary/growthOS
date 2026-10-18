import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'

// Permanently deletes a user account. Every table's rows go with it (all
// user foreign keys are ON DELETE CASCADE); their own gallery files are
// removed from storage first, since storage isn't covered by the cascade.
// Admins only; nobody can delete themselves; only a superadmin can delete
// another admin or superadmin. The client must echo the user's email back
// as a confirmation.
export async function POST(req: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: caller } = await supabase
    .from('user_profiles').select('is_admin, is_superadmin').eq('id', user.id).single()
  if (!caller?.is_admin && !caller?.is_superadmin)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId, confirmEmail } = await req.json() as { userId?: string; confirmEmail?: string }
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })
  if (userId === user.id) return NextResponse.json({ error: "You can't delete your own account here" }, { status: 400 })

  const admin = createSupabaseAdminClient()
  const { data: target, error: targetErr } = await admin.auth.admin.getUserById(userId)
  if (targetErr || !target?.user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (!confirmEmail || confirmEmail.trim().toLowerCase() !== (target.user.email ?? '').toLowerCase())
    return NextResponse.json({ error: 'Type the user’s email to confirm' }, { status: 400 })

  const { data: targetProfile } = await admin
    .from('user_profiles').select('is_admin, is_superadmin').eq('id', userId).maybeSingle()
  if ((targetProfile?.is_admin || targetProfile?.is_superadmin) && !caller.is_superadmin)
    return NextResponse.json({ error: 'Only a superadmin can delete an admin' }, { status: 403 })

  // Their own (non-global) gallery uploads.
  const { data: files } = await admin.from('user_gallery').select('storage_path').eq('user_id', userId).eq('is_global', false)
  const paths = (files ?? []).map(f => f.storage_path).filter(Boolean) as string[]
  if (paths.length) await admin.storage.from('gallery').remove(paths)

  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
