import Link from 'next/link'
import { Settings } from 'lucide-react'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import Sidebar from '@/components/layout/Sidebar'
import BottomNav from '@/components/layout/BottomNav'
import ServiceWorkerRegister from '@/components/layout/ServiceWorkerRegister'
import ZenithIcon from '@/components/layout/ZenithIcon'
import { TimerProvider } from '@/contexts/TimerContext'
import FloatingTimer from '@/components/focus/FloatingTimer'

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, avatar_url')
    .eq('id', user.id)
    .single()

  return (
    <TimerProvider>
    <div className="min-h-screen text-white">
      <Sidebar
        userName={profile?.full_name ?? user.email ?? 'User'}
        userEmail={user.email ?? ''}
        avatarUrl={profile?.avatar_url ?? null}
      />

      {/* Mobile top bar */}
      <header className="fixed top-0 left-0 right-0 z-40 flex h-14 items-center justify-between border-b border-white/[0.06] bg-[#06060f]/95 backdrop-blur-md px-4 md:hidden">
        <Link href="/dashboard" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <ZenithIcon className="h-7 w-7" />
          <span className="text-base font-bold text-white tracking-tight">Zenith</span>
        </Link>
        <Link href="/settings" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06] transition-colors">
          <Settings className="h-4 w-4" />
        </Link>
      </header>

      <main className="md:ml-64 pb-20 md:pb-0 pt-14 md:pt-0">
        {children}
      </main>
      <BottomNav />
      <FloatingTimer />
      <ServiceWorkerRegister />
      <div className="fixed bottom-1.5 right-2 text-[9px] text-slate-800 font-mono select-none pointer-events-none z-50 hidden md:block">
        {process.env.NEXT_PUBLIC_GIT_BRANCH}/{process.env.NEXT_PUBLIC_GIT_COMMIT}
      </div>
    </div>
    </TimerProvider>
  )
}
