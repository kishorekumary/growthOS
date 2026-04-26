import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = createSupabaseServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('onboarding_done')
        .single()

      return NextResponse.redirect(
        `${origin}${profile?.onboarding_done ? '/dashboard' : '/onboarding'}`
      )
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth_failed`)
}
