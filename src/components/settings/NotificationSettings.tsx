'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Bell, BellOff, Mail, MailCheck, Clock, Loader2,
  CheckCircle, AlertCircle, Send, Plus, X, Phone, PhoneOff,
} from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  return Uint8Array.from(raw, c => c.charCodeAt(0))
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-40',
        checked ? 'bg-violet-600' : 'bg-white/10'
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-6' : 'translate-x-1'
        )}
      />
    </button>
  )
}

export default function NotificationSettings() {
  const [loading, setLoading]           = useState(true)
  const [saving, setSaving]             = useState(false)
  const [subscribing, setSubscribing]   = useState(false)
  const [testing, setTesting]           = useState(false)
  const [saved, setSaved]               = useState(false)
  const [error, setError]               = useState<string | null>(null)

  const [pushSupported, setPushSupported]   = useState(false)
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default')
  const [pushEnabled, setPushEnabled]       = useState(false)
  const [emailEnabled, setEmailEnabled]     = useState(false)
  const [callEnabled, setCallEnabled]       = useState(false)
  const [phoneNumber, setPhoneNumber]       = useState('')
  const [times, setTimes]     = useState<string[]>(['08:00', '18:00'])
  const [timezone, setTimezone] = useState('UTC')

  const loadSettings = useCallback(async () => {
    const supabase = createSupabaseBrowserClient()
    const { data } = await supabase
      .from('notification_settings')
      .select('push_enabled, email_enabled, call_enabled, phone_number, reminder_times, timezone')
      .maybeSingle()

    if (data) {
      setEmailEnabled(data.email_enabled ?? false)
      setCallEnabled(data.call_enabled ?? false)
      setPhoneNumber(data.phone_number ?? '')
      setTimes((data.reminder_times as string[] | null) ?? ['08:00', '18:00'])
      setTimezone(data.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone)
      if (data.push_enabled && 'serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready.catch(() => null)
        const sub = await reg?.pushManager.getSubscription().catch(() => null)
        setPushEnabled(!!sub)
      }
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window
    setPushSupported(supported)
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone)
    if ('Notification' in window) setPushPermission(Notification.permission)
    loadSettings()
  }, [loadSettings])

  async function handlePushToggle() {
    if (pushEnabled) await unsubscribePush()
    else await subscribePush()
  }

  async function subscribePush() {
    setError(null)
    setSubscribing(true)
    try {
      if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
        setError('Push notifications are not configured yet.')
        return
      }
      const permission = await Notification.requestPermission()
      setPushPermission(permission)
      if (permission !== 'granted') {
        setError('Notification permission denied. Enable it in your browser settings.')
        return
      }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
      })
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      })
      if (!res.ok) throw new Error('Failed to save subscription')
      setPushEnabled(true)
    } catch (e) {
      setError((e as Error).message ?? 'Failed to enable push notifications')
    } finally {
      setSubscribing(false)
    }
  }

  async function unsubscribePush() {
    setSubscribing(true)
    try {
      const reg = await navigator.serviceWorker.ready.catch(() => null)
      const sub = await reg?.pushManager.getSubscription().catch(() => null)
      if (sub) {
        const endpoint = sub.endpoint
        await sub.unsubscribe()
        await fetch('/api/push/unsubscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        })
      }
      setPushEnabled(false)
    } catch (e) {
      setError((e as Error).message ?? 'Failed to disable push notifications')
    } finally {
      setSubscribing(false)
    }
  }

  function addTime() {
    if (times.length >= 8) return
    setTimes(prev => [...prev, '09:00'])
  }

  function removeTime(index: number) {
    setTimes(prev => prev.filter((_, i) => i !== index))
  }

  function updateTime(index: number, value: string) {
    setTimes(prev => prev.map((t, i) => i === index ? value : t))
  }

  async function saveSettings() {
    setSaving(true)
    setSaved(false)
    setError(null)
    const supabase = createSupabaseBrowserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); setError('Not signed in.'); return }

    const { error: err } = await supabase.from('notification_settings').upsert(
      {
        user_id:        user.id,
        push_enabled:   pushEnabled,
        email_enabled:  emailEnabled,
        call_enabled:   callEnabled,
        phone_number:   phoneNumber.trim() || null,
        reminder_times: times,
        timezone,
        sent_today:     {},   // reset so updated times fire fresh
        updated_at:     new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    if (err) {
      setError('Failed to save settings.')
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
    setSaving(false)
  }

  async function sendTestPush() {
    setTesting(true)
    setError(null)
    const res = await fetch('/api/push/test', { method: 'POST' })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Failed to send test notification')
    }
    setTesting(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
    </div>
  )

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {saved && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
          <CheckCircle className="h-4 w-4 text-emerald-400" />
          <p className="text-sm text-emerald-300">Settings saved</p>
        </div>
      )}

      {/* Push notifications */}
      <div className="rounded-xl border border-white/8 bg-white/3 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/20">
              {pushEnabled
                ? <Bell className="h-4 w-4 text-violet-400" />
                : <BellOff className="h-4 w-4 text-slate-500" />}
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Push Notifications</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {!pushSupported
                  ? 'Not supported in this browser'
                  : pushPermission === 'denied'
                  ? 'Blocked — enable in browser settings'
                  : pushEnabled
                  ? 'Active on this device'
                  : 'Get reminders on this device'}
              </p>
            </div>
          </div>
          <Toggle
            checked={pushEnabled}
            onChange={handlePushToggle}
            disabled={subscribing || !pushSupported || pushPermission === 'denied'}
          />
        </div>

        {subscribing && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {pushEnabled ? 'Unsubscribing...' : 'Requesting permission...'}
          </div>
        )}

        {pushEnabled && (
          <Button
            variant="outline"
            size="sm"
            onClick={sendTestPush}
            disabled={testing}
            className="border-white/10 bg-white/5 text-slate-300 hover:text-white text-xs h-8"
          >
            {testing
              ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Sending...</>
              : <><Send className="mr-1.5 h-3.5 w-3.5" /> Send test notification</>}
          </Button>
        )}
      </div>

      {/* Email notifications */}
      <div className="rounded-xl border border-white/8 bg-white/3 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/20">
              {emailEnabled
                ? <MailCheck className="h-4 w-4 text-sky-400" />
                : <Mail className="h-4 w-4 text-slate-500" />}
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Email Reminders</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {emailEnabled ? 'Reminder emails enabled' : 'Get reminders to your email'}
              </p>
            </div>
          </div>
          <Toggle checked={emailEnabled} onChange={() => setEmailEnabled(v => !v)} />
        </div>
      </div>

      {/* Phone call */}
      <div className="rounded-xl border border-white/8 bg-white/3 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/20">
              {callEnabled
                ? <Phone className="h-4 w-4 text-emerald-400" />
                : <PhoneOff className="h-4 w-4 text-slate-500" />}
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Phone Call Reminders</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {callEnabled ? 'Call reminders active' : 'Get a voice call at reminder times'}
              </p>
            </div>
          </div>
          <Toggle checked={callEnabled} onChange={() => setCallEnabled(v => !v)} />
        </div>

        {callEnabled && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">Phone number</label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={e => setPhoneNumber(e.target.value)}
              placeholder="+91 98765 43210"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <p className="text-[11px] text-slate-600">Include country code — e.g. +91 for India, +1 for US.</p>
          </div>
        )}
      </div>

      {/* Reminder times */}
      <div className="rounded-xl border border-white/8 bg-white/3 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-400" />
            <p className="text-sm font-semibold text-white">Reminder Times</p>
          </div>
          <span className="text-xs text-slate-500">{times.length}/8</span>
        </div>

        <div className="space-y-2">
          {times.map((t, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="time"
                value={t}
                onChange={e => updateTime(i, e.target.value)}
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
              {times.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeTime(i)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 text-slate-600 hover:border-red-500/30 hover:text-red-400 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>

        {times.length < 8 && (
          <button
            type="button"
            onClick={addTime}
            className="flex items-center gap-2 text-xs text-slate-500 hover:text-violet-400 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add reminder time
          </button>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-400">Your timezone</label>
          <input
            type="text"
            value={timezone}
            onChange={e => setTimezone(e.target.value)}
            placeholder="e.g. Asia/Kolkata"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
          <p className="text-[11px] text-slate-600">Auto-detected. Use IANA format (e.g. Asia/Kolkata, America/New_York).</p>
        </div>

      </div>

      <Button
        onClick={saveSettings}
        disabled={saving}
        className="w-full bg-violet-600 hover:bg-violet-700 text-white"
      >
        {saving
          ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
          : 'Save Notification Settings'}
      </Button>
    </div>
  )
}
