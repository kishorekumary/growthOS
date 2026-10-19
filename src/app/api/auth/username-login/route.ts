import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { normalizeUsername, usernameProblem } from '@/lib/username'

const INVALID = 'Invalid username or password'

// Sign in with username + password. The username is resolved to the
// account's email on the server (never sent back), then the normal
// password sign-in runs here so the session cookies are set on this
// response. Unknown usernames and wrong passwords get the same answer, so
// the endpoint can't be used to discover accounts.
export async function POST(req: Request) {
  const { username, password } = await req.json().catch(() => ({})) as { username?: string; password?: string }
  if (!username || !password) return NextResponse.json({ error: INVALID }, { status: 400 })
  if (usernameProblem(username)) return NextResponse.json({ error: INVALID }, { status: 401 })

  const admin = createSupabaseAdminClient()
  const { data: profile, error: lookupErr } = await admin
    .from('user_profiles').select('id').eq('username', normalizeUsername(username)).maybeSingle()
  if (lookupErr) {
    // Column missing until migration 055 is applied.
    return NextResponse.json({ error: 'Username sign-in isn’t set up yet. Use your email.' }, { status: 503 })
  }
  if (!profile) return NextResponse.json({ error: INVALID }, { status: 401 })

  const { data: account } = await admin.auth.admin.getUserById(profile.id)
  const email = account?.user?.email
  if (!email) return NextResponse.json({ error: INVALID }, { status: 401 })

  const supabase = createSupabaseServerClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return NextResponse.json({ error: INVALID }, { status: 401 })

  const { data: me } = await supabase.from('user_profiles').select('onboarding_done').eq('id', profile.id).single()
  return NextResponse.json({ ok: true, next: me?.onboarding_done ? '/dashboard' : '/onboarding' })
}
