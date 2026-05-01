'use client'

import { useEffect } from 'react'
import { useReminderNotifications } from '@/hooks/useReminderNotifications'

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])

  // Client-side fallback: fires browser Notification when the app tab is open
  // and a reminder time is reached (works regardless of server-cron timing).
  useReminderNotifications()

  return null
}
