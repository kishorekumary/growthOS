'use client'

import { useEffect, useState } from 'react'
import { HeartPulse, Loader2, RefreshCw, Settings2, CheckCircle2, AlertCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import {
  healthAvailability, connectHealth, disconnectHealth, syncHealth, openHealthSettings,
  isHealthConnected, lastHealthSync, type SyncResult,
} from '@/lib/health/sync'

// Settings → Samsung Health: connect through Health Connect, sync now, and
// see when it last synced. Workouts and sleep land in Fitness and Sleep.
export default function HealthSettings() {
  const [avail, setAvail]         = useState<{ available: boolean; reason?: string } | null>(null)
  const [connected, setConnected] = useState(false)
  const [last, setLast]           = useState<string | null>(null)
  const [busy, setBusy]           = useState<'connect' | 'sync' | null>(null)
  const [result, setResult]       = useState<SyncResult | null>(null)
  const [message, setMessage]     = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    healthAvailability().then(setAvail)
    setConnected(isHealthConnected())
    setLast(lastHealthSync())
  }, [])

  async function sync() {
    setBusy('sync'); setMessage(null)
    try {
      const r = await syncHealth()
      setResult(r); setLast(lastHealthSync())
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Sync failed' })
    }
    setBusy(null)
  }

  async function connect() {
    setBusy('connect'); setMessage(null)
    try {
      const r = await connectHealth()
      if (!r.ok) { setMessage({ ok: false, text: r.message ?? 'Permission not granted' }); setBusy(null); return }
      setConnected(true)
      if (r.message) setMessage({ ok: true, text: r.message })
      setBusy(null)
      await sync()
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Could not connect' })
      setBusy(null)
    }
  }

  return (
    <div className="rounded-xl border border-white/8 bg-white/3 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-500/15">
          <HeartPulse className="h-4 w-4 text-rose-300" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">Samsung Health</p>
          <p className="text-xs text-slate-500">
            {connected
              ? <>Importing workouts and sleep{last && <> · synced {formatDistanceToNow(new Date(last), { addSuffix: true })}</>}</>
              : 'Import your workouts and sleep automatically, through Android Health Connect.'}
          </p>
        </div>
      </div>

      {avail && !avail.available ? (
        <p className="rounded-lg bg-white/[0.04] px-3 py-2 text-xs text-slate-400">{avail.reason}</p>
      ) : !connected ? (
        <>
          <ol className="list-decimal space-y-0.5 pl-5 text-[11px] text-slate-500">
            <li>In Samsung Health, turn on syncing with Health Connect.</li>
            <li>Tap Connect and allow <b className="text-slate-300">Exercise</b> and <b className="text-slate-300">Sleep</b>.</li>
          </ol>
          <button onClick={connect} disabled={!avail || busy !== null}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 py-2.5 text-sm font-semibold text-snow active:scale-[0.98] disabled:opacity-50 transition">
            {busy === 'connect' ? <Loader2 className="h-4 w-4 animate-spin" /> : <HeartPulse className="h-4 w-4" />}
            Connect Samsung Health
          </button>
        </>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button onClick={sync} disabled={busy !== null}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-500/25 disabled:opacity-50">
            {busy === 'sync' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Sync now
          </button>
          <button onClick={openHealthSettings}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:text-white">
            <Settings2 className="h-3.5 w-3.5" /> Permissions
          </button>
          <button onClick={() => { disconnectHealth(); setConnected(false); setLast(null); setResult(null) }}
            className="rounded-lg px-3 py-2 text-xs text-slate-500 hover:text-red-300">
            Disconnect
          </button>
        </div>
      )}

      {result && (
        <p className="flex items-center gap-1.5 text-xs text-emerald-300">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Imported {result.workouts} workout{result.workouts === 1 ? '' : 's'} and {result.nights} night{result.nights === 1 ? '' : 's'} of sleep
          {result.skippedNights > 0 && <span className="text-slate-500"> · kept {result.skippedNights} you logged yourself</span>}
        </p>
      )}
      {message && (
        <p className={`flex items-center gap-1.5 text-xs ${message.ok ? 'text-slate-400' : 'text-red-400'}`}>
          {!message.ok && <AlertCircle className="h-3.5 w-3.5" />}{message.text}
        </p>
      )}
    </div>
  )
}
