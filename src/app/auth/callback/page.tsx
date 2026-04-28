'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import type { Session } from '@supabase/supabase-js'

function CallbackHandler() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Surface OAuth provider errors immediately
    const oauthError = searchParams.get('error')
    if (oauthError) {
      const desc = searchParams.get('error_description') ?? oauthError
      router.replace(`/login?error=${encodeURIComponent(desc)}`)
      return
    }

    const supabase = createSupabaseBrowserClient()
    let settled = false

    async function finish(session: Session) {
      if (settled) return
      settled = true
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('onboarding_done')
        .eq('id', session.user.id)
        .single()
      router.replace(profile?.onboarding_done ? '/dashboard' : '/onboarding')
    }

    // createBrowserClient sets detectSessionInUrl:true by default, so it
    // auto-exchanges the PKCE code (reading the verifier from document.cookie)
    // during client initialisation. We just need to react to the outcome.

    // 1. Session may already be established if initialize() ran synchronously.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) finish(session)
    })

    // 2. Otherwise wait for the SIGNED_IN / INITIAL_SESSION event.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) finish(session)
      }
    )

    // 3. Hard timeout — something went very wrong.
    const timer = setTimeout(() => {
      if (!settled) router.replace('/login?error=sign_in_failed')
    }, 8000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timer)
    }
  }, [router, searchParams])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0f0f13]">
      <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
      <p className="text-sm text-slate-400">Signing you in…</p>
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
