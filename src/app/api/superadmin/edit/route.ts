import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'

const ALLOWED_TABLES = [
  'user_profiles',
  'personality_habits',
  'reading_log',
  'user_goals',
  'user_todos',
  'workout_logs',
  'journal_entries',
] as const
type AllowedTable = (typeof ALLOWED_TABLES)[number]

async function requireSuperadmin() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, status: 401, error: 'Unauthorized' }
  const { data } = await supabase.from('user_profiles').select('is_superadmin').eq('id', user.id).single()
  if (!data?.is_superadmin) return { ok: false as const, status: 403, error: 'Superadmin only' }
  return { ok: true as const }
}

// PATCH — update an existing row
export async function PATCH(req: Request) {
  const guard = await requireSuperadmin()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { table, id, data } = await req.json() as { table: string; id: string; data: Record<string, unknown> }
  if (!ALLOWED_TABLES.includes(table as AllowedTable))
    return NextResponse.json({ error: 'Table not allowed' }, { status: 400 })

  const admin = createSupabaseAdminClient()
  const { error } = await admin.from(table as AllowedTable).update(data).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// POST — insert a new row
export async function POST(req: Request) {
  const guard = await requireSuperadmin()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { table, data } = await req.json() as { table: string; data: Record<string, unknown> }
  if (!ALLOWED_TABLES.includes(table as AllowedTable))
    return NextResponse.json({ error: 'Table not allowed' }, { status: 400 })

  const admin = createSupabaseAdminClient()
  const { data: row, error } = await admin.from(table as AllowedTable).insert(data).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ row })
}

// DELETE — remove a row by id
export async function DELETE(req: Request) {
  const guard = await requireSuperadmin()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { searchParams } = new URL(req.url)
  const table = searchParams.get('table')
  const id    = searchParams.get('id')
  if (!table || !id) return NextResponse.json({ error: 'table and id required' }, { status: 400 })
  if (!ALLOWED_TABLES.includes(table as AllowedTable))
    return NextResponse.json({ error: 'Table not allowed' }, { status: 400 })

  const admin = createSupabaseAdminClient()
  const { error } = await admin.from(table as AllowedTable).delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
