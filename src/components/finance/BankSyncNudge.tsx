'use client'

import { useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Mail, MailCheck, RefreshCw, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Status { connected: boolean; lastSyncedAt: string | null; stale: boolean }

const DISMISS_KEY = 'growthos:bank-sync-nudge-dismissed'
const connect = () => { window.location.href = '/api/integrations/gmail/connect' }

// Brings Bank Email Sync (Settings → Finance Integrations) to where
// spending is logged: an invitation when it's off, a quiet "synced 2h ago"
// when it's on, a Reconnect when it has gone stale. `compact` is a single
// line for tight spots (the Quick Log spending tile).
export default function BankSyncNudge({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState<Status | null>(null)
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    try { setDismissed(localStorage.getItem(DISMISS_KEY) === '1') } catch { setDismissed(false) }
    fetch('/api/integrations/gmail/status')
      .then(r => (r.ok ? r.json() : null))
      .then(setStatus)
      .catch(() => {})
  }, [])

  if (!status) return null

  if (status.connected && !status.stale) {
    return (
      <p className={cn('flex items-center gap-1.5 text-[11px] text-emerald-300/80', !compact && 'px-1')}>
        <MailCheck className="h-3.5 w-3.5" />
        Auto-importing Axis Bank transactions
        {status.lastSyncedAt && <span className="text-slate-500">· synced {formatDistanceToNow(new Date(status.lastSyncedAt), { addSuffix: true })}</span>}
      </p>
    )
  }

  if (status.connected && status.stale) {
    return (
      <button type="button" onClick={connect}
        className="flex w-full items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-left text-xs text-amber-200 hover:bg-amber-500/15">
        <RefreshCw className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1">Bank email sync has stopped. Reconnect Gmail to keep auto-importing.</span>
        <span className="font-semibold">Reconnect</span>
      </button>
    )
  }

  if (dismissed) return null
  const dismiss = () => { setDismissed(true); try { localStorage.setItem(DISMISS_KEY, '1') } catch {} }

  if (compact) {
    return (
      <button type="button" onClick={connect} className="flex items-center gap-1.5 text-[11px] text-sky-300/90 hover:text-sky-200">
        <Mail className="h-3.5 w-3.5" /> Bank with Axis? Auto-import expenses from Gmail →
      </button>
    )
  }

  return (
    <div className="card-sheen relative flex items-start gap-3 rounded-2xl border border-sky-500/25 bg-gradient-to-br from-sky-500/15 to-transparent p-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/20">
        <Mail className="h-4 w-4 text-sky-300" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white">Stop typing your expenses</p>
        <p className="mt-0.5 text-xs text-slate-400">
          Bank with Axis? Connect Gmail and your Axis Bank alert emails become transactions automatically.
        </p>
        <button type="button" onClick={connect}
          className="mt-2.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-snow hover:bg-sky-700 active:scale-95 transition">
          Connect Gmail
        </button>
      </div>
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="rounded p-1 text-slate-500 hover:text-white">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
