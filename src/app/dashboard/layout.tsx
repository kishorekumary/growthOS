import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import Sidebar from '@/components/layout/Sidebar'
import BottomNav from '@/components/layout/BottomNav'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
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
      <main className="md:ml-64 pb-20 md:pb-0">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
