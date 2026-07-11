'use client'

import { WifiOff } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

export default function OfflineBanner() {
  const online = useOnlineStatus()
  if (online) return null

  return (
    <div className="fixed top-16 md:top-4 left-1/2 -translate-x-1/2 z-[200] w-full max-w-sm px-4 pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-amber-500/30 bg-[#0d0d1a]/95 backdrop-blur-sm shadow-2xl px-4 py-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 shrink-0">
          <WifiOff className="h-3.5 w-3.5 text-amber-400" />
        </div>
        <p className="text-sm text-amber-200">You&apos;re offline — showing saved data</p>
      </div>
    </div>
  )
}
