import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const errorParam = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  if (errorParam) {
    console.error('OAuth error from provider:', errorParam, errorDescription)
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(errorDescription ?? errorParam)}`
    )
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  try {
    const supabase = createSupabaseServerClient()
    const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code)

    if (sessionError) {
      console.error('Session exchange error:', sessionError.message)
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(sessionError.message)}`
      )
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('onboarding_done')
      .single()

    return NextResponse.redirect(
      `${origin}${profile?.onboarding_done ? '/dashboard' : '/onboarding'}`
    )
  } catch (err) {
    console.error('Callback route error:', err)
    return NextResponse.redirect(`${origin}/login?error=callback_failed`)
  }
}
