'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Loader2, Bell, ShieldCheck, ChevronRight } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'

const NotificationSettings = dynamic(
  () => import('@/components/settings/NotificationSettings'),
  { loading: () => <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-slate-500" /></div> }
)

export default function SettingsPage() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)

  useEffect(() => {
    async function checkAdmin() {
      const sb = createSupabaseBrowserClient()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { setIsAdmin(false); return }
      const { data } = await sb
        .from('user_profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()
      setIsAdmin(data?.is_admin ?? false)
    }
    checkAdmin()
  }, [])

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-slate-400 text-sm mt-1">Manage your notification preferences</p>
      </div>

      <div className="mb-2">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="h-4 w-4 text-violet-400" />
          <h2 className="text-base font-semibold text-white">Notifications</h2>
        </div>
        <NotificationSettings />
      </div>

      {/* Admin section — only visible to admins */}
      {isAdmin === true && (
        <div className="mt-10 border-t border-white/[0.05] pt-6">
          <button
            onClick={() => router.push('/admin')}
            className="w-full flex items-center gap-3 rounded-xl border border-violet-500/20 bg-violet-500/[0.06] px-4 py-3 text-left hover:bg-violet-500/[0.12] hover:border-violet-500/30 transition-all group"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/20 shrink-0">
              <ShieldCheck className="h-4 w-4 text-violet-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-violet-300">Admin Panel</p>
              <p className="text-xs text-slate-600">Manage users, content &amp; platform settings</p>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-700 group-hover:text-violet-500 transition-colors shrink-0" />
          </button>
        </div>
      )}
    </div>
  )
}
