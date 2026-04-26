import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const errorParam = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  if (errorParam) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(errorDescription ?? errorParam)}`
    )
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  // Collect cookies set during the exchange so we can apply them to any response
  const cookiesToApply: { name: string; value: string; options: CookieOptions }[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach((c) => cookiesToApply.push(c))
        },
      },
    }
  )

  const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code)

  if (sessionError) {
    console.error('Session exchange error:', sessionError.message)
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(sessionError.message)}`
    )
  }

  // Decide where to send the user
  const { data: { user } } = await supabase.auth.getUser()
  let destination = '/onboarding'

  if (user) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('onboarding_done')
      .eq('id', user.id)
      .single()

    if (profile?.onboarding_done) destination = '/dashboard'
  }

  // Build the final redirect and stamp all auth cookies onto it
  const response = NextResponse.redirect(`${origin}${destination}`)
  cookiesToApply.forEach(({ name, value, options }) =>
    response.cookies.set(name, value, options)
  )

  return response
}
