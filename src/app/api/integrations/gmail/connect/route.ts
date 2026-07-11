import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { randomUUID } from 'crypto'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getGmailAuthUrl } from '@/lib/gmail'

export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const state = randomUUID()
  cookies().set('gmail_oauth_state', state, {
    httpOnly:  true,
    secure:    true,
    sameSite:  'lax',
    maxAge:    600,
    path:      '/',
  })

  return NextResponse.redirect(getGmailAuthUrl(state))
}
