'use client'

import dynamic from 'next/dynamic'
import { Loader2, Bell } from 'lucide-react'

const NotificationSettings = dynamic(
  () => import('@/components/settings/NotificationSettings'),
  { loading: () => <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-slate-500" /></div> }
)

export default function SettingsPage() {
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
    </div>
  )
}
