import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

// Initiates Google OAuth from the server so the PKCE code verifier is
// written into a response cookie rather than browser localStorage. This
// guarantees the verifier survives the cross-site redirect chain back to
// /auth/callback where the server-side exchange reads it from request cookies.
export async function GET(request: NextRequest) {
  const cookieStore = cookies()
  const origin = new URL(request.url).origin

  const pending: { name: string; value: string; options: CookieOptions }[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach((c) => pending.push(c))
        },
      },
    }
  )

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  })

  if (error || !data.url) {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(error?.message ?? 'Google sign-in failed')}`,
        request.url
      )
    )
  }

  // Stamp all auth cookies (including PKCE verifier) onto the redirect response
  const response = NextResponse.redirect(data.url)
  pending.forEach(({ name, value, options }) =>
    response.cookies.set(name, value, options)
  )

  return response
}
