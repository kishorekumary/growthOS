'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'

function CallbackHandler() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const code = searchParams.get('code')
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    if (error) {
      router.replace(`/login?error=${encodeURIComponent(errorDescription ?? error)}`)
      return
    }

    if (!code) {
      router.replace('/login?error=missing_code')
      return
    }

    // Exchange the PKCE code in the browser so createBrowserClient can read
    // the code verifier from document.cookie directly — no server-cookie lookup needed.
    const supabase = createSupabaseBrowserClient()

    supabase.auth.exchangeCodeForSession(code).then(async ({ data, error: sessionError }) => {
      if (sessionError) {
        router.replace(`/login?error=${encodeURIComponent(sessionError.message)}`)
        return
      }

      const user = data.session?.user
      if (!user) {
        router.replace('/login?error=no_session')
        return
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('onboarding_done')
        .eq('id', user.id)
        .single()

      router.replace(profile?.onboarding_done ? '/dashboard' : '/onboarding')
    })
  }, [router, searchParams])

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f0f13]">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
        <p className="text-sm text-slate-400">Signing you in…</p>
      </div>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0f0f13]">
          <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  )
}
