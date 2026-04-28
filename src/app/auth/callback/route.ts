import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const oauthError = searchParams.get('error')
  const oauthErrorDesc = searchParams.get('error_description')

  // Vercel sets x-forwarded-host; use it so the redirect stays on the right domain.
  const host = request.headers.get('x-forwarded-host')
  const origin = host ? `https://${host}` : new URL(request.url).origin

  if (oauthError) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(oauthErrorDesc ?? oauthError)}`, origin)
    )
  }

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=no_code', origin))
  }

  const cookieStore = cookies()
  const pending: { name: string; value: string; options: CookieOptions }[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        // Collect cookies into pending[] — we'll stamp them onto the redirect response.
        setAll(cookiesToSet) {
          cookiesToSet.forEach((c) => pending.push(c))
        },
      },
    }
  )

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(exchangeError.message)}`, origin)
    )
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let redirectPath = '/onboarding'
  if (user) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('onboarding_done')
      .eq('id', user.id)
      .single()
    if (profile?.onboarding_done) redirectPath = '/dashboard'
  }

  const response = NextResponse.redirect(new URL(redirectPath, origin))
  // Stamp the session cookies (access token, refresh token, etc.) onto the redirect.
  pending.forEach(({ name, value, options }) => response.cookies.set(name, value, options))

  return response
}
