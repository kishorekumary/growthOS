import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase-server'

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
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0f0f13] px-6 text-center">
      <div className="max-w-md">
        <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600/20 ring-1 ring-violet-500/30">
          <span className="text-2xl">🌱</span>
        </div>

        <h1 className="mb-3 text-4xl font-bold text-white">GrowthOS</h1>
        <p className="mb-10 text-slate-400 leading-relaxed">
          Your personal growth companion — personality, fitness, finance, and books in one place.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/login"
            className="rounded-xl bg-violet-600 px-8 py-3 text-sm font-semibold text-white hover:bg-violet-700 transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-xl border border-white/10 bg-white/5 px-8 py-3 text-sm font-semibold text-slate-300 hover:border-white/20 hover:text-white transition-colors"
          >
            Create account
          </Link>
        </div>
      </div>
    </main>
  )
}
