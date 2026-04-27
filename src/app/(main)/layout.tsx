import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import Sidebar from '@/components/layout/Sidebar'
import BottomNav from '@/components/layout/BottomNav'
import ServiceWorkerRegister from '@/components/layout/ServiceWorkerRegister'

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
    <div className="min-h-screen bg-slate-950 text-white">
      <Sidebar
        userName={profile?.full_name ?? user.email ?? 'User'}
        userEmail={user.email ?? ''}
        avatarUrl={profile?.avatar_url ?? null}
      />

      {/* Mobile top bar — hidden on desktop where sidebar is shown */}
      <header className="fixed top-0 left-0 right-0 z-40 flex h-14 items-center border-b border-white/10 bg-slate-950/95 backdrop-blur-sm px-4 md:hidden">
        <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-600/20 border border-purple-500/30">
            <span className="text-xs">🌱</span>
          </div>
          <span className="text-base font-bold text-white tracking-tight">
            Growth<span className="text-purple-400">OS</span>
          </span>
        </Link>
      </header>

      <main className="md:ml-64 pb-20 md:pb-0 pt-14 md:pt-0">
        {children}
      </main>
      <BottomNav />
      <ServiceWorkerRegister />
    </div>
  )
}
