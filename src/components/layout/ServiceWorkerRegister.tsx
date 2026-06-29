'use client'

import { useEffect } from 'react'
import { useReminderNotifications } from '@/hooks/useReminderNotifications'

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  return Uint8Array.from(raw, c => c.charCodeAt(0))
}

// Silently register a push subscription for this device if the user has
// already granted notification permission. This runs on every page load so
// both desktop AND phone get a subscription without the user visiting Settings.
async function autoSubscribePush() {
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window) ||
    Notification.permission !== 'granted' ||
    !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  ) return

  try {
    const reg = await navigator.serviceWorker.ready
    const existing = await reg.pushManager.getSubscription()
    if (existing) return // already subscribed on this device

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
    })

    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub.toJSON()),
    })
  } catch {
    // Best-effort — never throw, never block the page
  }
}

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then(() => autoSubscribePush())
        .catch(() => {})
    }
  }, [])

  // Client-side fallback: fires browser Notification when the app tab is open
  // and a reminder time is reached (works regardless of server-cron timing).
  useReminderNotifications()

  return null
}
