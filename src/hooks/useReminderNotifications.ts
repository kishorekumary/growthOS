'use client'

import { useEffect, useRef } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'

interface Settings {
  push_enabled: boolean
  reminder_times: string[] | null
  timezone: string | null
}

// Returns how many minutes ago `reminderTime` (HH:MM) was in the given IANA timezone.
// Returns a negative number if the reminder hasn't happened yet this minute.
function minutesSinceReminder(reminderTime: string, tz: string): number {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
  const parts = Object.fromEntries(formatter.formatToParts(now).map(p => [p.type, p.value]))
  const ch = parseInt(parts.hour ?? '0')
  const cm = parseInt(parts.minute ?? '0')
  const [rh, rm] = reminderTime.split(':').map(Number)
  const currentMins  = ch * 60 + cm
  const reminderMins = rh * 60 + rm
  // Wrap across midnight
  return (currentMins - reminderMins + 1440) % 1440
}

export function useReminderNotifications() {
  const firedTodayRef = useRef<Set<string>>(new Set())
  const settingsRef   = useRef<Settings | null>(null)
  const todayKeyRef   = useRef('')

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return

    // Load settings once, then rely on the ref
    async function loadSettings() {
      const supabase = createSupabaseBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return
      const { data } = await supabase
        .from('notification_settings')
        .select('push_enabled, reminder_times, timezone')
        .maybeSingle()
      if (data) settingsRef.current = data as Settings
    }

    loadSettings()

    function check() {
      const s = settingsRef.current
      if (!s?.push_enabled || !s.reminder_times?.length) return
      if (Notification.permission !== 'granted') return

      const tz = s.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone

      // Reset fired-today set at midnight
      const todayKey = new Date().toDateString()
      if (todayKey !== todayKeyRef.current) {
        todayKeyRef.current = todayKey
        firedTodayRef.current = new Set()
      }

      for (const reminderTime of s.reminder_times) {
        const fireKey = `${reminderTime}-${todayKey}`
        if (firedTodayRef.current.has(fireKey)) continue

        const minAgo = minutesSinceReminder(reminderTime, tz)
        // Fire if within the past 2 minutes (catches the minute it's due
        // plus one more tick in case the interval fires a few seconds early)
        if (minAgo >= 0 && minAgo < 2) {
          firedTodayRef.current.add(fireKey)
          try {
            new Notification('GrowthOS Reminder 🌱', {
              body: "Time to check your tasks and goals — keep the momentum going!",
              icon: '/icon-192.png',
              badge: '/icon-96.png',
              tag: `reminder-${reminderTime}`,
            })
          } catch {}
        }
      }
    }

    // Check immediately then every 60 seconds
    check()
    const interval = setInterval(check, 60_000)
    return () => clearInterval(interval)
  }, [])
}
