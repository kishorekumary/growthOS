import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { exchangeCodeForTokens, getGmailProfile } from '@/lib/gmail'

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://growthos.app'
  const code   = req.nextUrl.searchParams.get('code')
  const state  = req.nextUrl.searchParams.get('state')
  const cookieStore = cookies()
  const expectedState = cookieStore.get('gmail_oauth_state')?.value
  cookieStore.delete('gmail_oauth_state')

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(`${appUrl}/settings?gmail=error`)
  }

  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${appUrl}/settings?gmail=error`)

  try {
    const tokens = await exchangeCodeForTokens(code)
    if (!tokens.refresh_token) {
      // Google omits refresh_token on repeat consents without prompt=consent forcing a re-issue.
      return NextResponse.redirect(`${appUrl}/settings?gmail=error`)
    }
    const gmailEmail = await getGmailProfile(tokens.access_token)

    const admin = createSupabaseAdminClient()
    await admin.from('bank_email_connections').upsert(
      {
        user_id:        user.id,
        gmail_email:    gmailEmail,
        refresh_token:  tokens.refresh_token,
        sync_enabled:   true,
        updated_at:     new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

    return NextResponse.redirect(`${appUrl}/settings?gmail=connected`)
  } catch (err) {
    console.error('[gmail/callback] failed', err)
    return NextResponse.redirect(`${appUrl}/settings?gmail=error`)
  }
}
