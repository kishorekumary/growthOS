'use client'

import { useEffect } from 'react'
import { autoSyncHealth } from '@/lib/health/sync'

// Health Connect only answers apps on screen, so import on open and when
// the app comes back to the foreground (throttled inside autoSyncHealth).
export default function HealthAutoSync() {
  useEffect(() => {
    autoSyncHealth()
    const onVisible = () => { if (document.visibilityState === 'visible') autoSyncHealth() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])
  return null
}
