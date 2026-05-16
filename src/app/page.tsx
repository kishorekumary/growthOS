import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import ZenithIcon from '@/components/layout/ZenithIcon'

export default async function RootPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('onboarding_done')
      .eq('id', user.id)
      .maybeSingle()
    redirect(profile?.onboarding_done ? '/dashboard' : '/onboarding')
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 flex items-start justify-center">
        <div className="h-[480px] w-[480px] -translate-y-1/4 rounded-full bg-indigo-500/10 blur-[100px]" />
      </div>

      <div className="relative max-w-md">
        {/* Icon */}
        <div className="mb-8 flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 rounded-2xl bg-indigo-500/20 blur-xl scale-125" />
            <ZenithIcon className="relative h-20 w-20" />
          </div>
        </div>

        {/* Headline */}
        <h1 className="mb-2 text-5xl font-extrabold tracking-tight text-white">
          Zenith
        </h1>
        <p className="mb-2 text-xs tracking-[0.25em] uppercase text-indigo-400/70 font-medium">
          Peak Performance
        </p>
        <p className="mt-5 mb-10 text-slate-400 leading-relaxed text-[15px]">
          Your AI-powered operating system for peak performance —<br />
          habits, goals, fitness, and finance in one place.
        </p>

        {/* CTA */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/login"
            className="rounded-xl bg-indigo-600 px-8 py-3 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/20"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-xl border border-white/10 bg-white/[0.04] px-8 py-3 text-sm font-semibold text-slate-300 hover:border-white/20 hover:text-white hover:bg-white/[0.07] transition-colors"
          >
            Create account
          </Link>
        </div>
      </div>
    </main>
  )
}
