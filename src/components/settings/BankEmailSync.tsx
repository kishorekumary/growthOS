'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Mail, MailCheck, Loader2, CheckCircle, AlertCircle, Unplug } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Status {
  connected:    boolean
  gmailEmail:   string | null
  syncEnabled:  boolean
  lastSyncedAt: string | null
}

export default function BankEmailSync() {
  const [loading, setLoading]         = useState(true)
  const [disconnecting, setDisconnecting] = useState(false)
  const [status, setStatus]           = useState<Status | null>(null)
  const [notice, setNotice]           = useState<'connected' | 'error' | null>(null)

  const loadStatus = useCallback(async () => {
    const res = await fetch('/api/integrations/gmail/status')
    if (res.ok) setStatus(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const gmail = params.get('gmail')
    if (gmail === 'connected' || gmail === 'error') {
      setNotice(gmail)
      window.history.replaceState({}, '', window.location.pathname)
    }
    loadStatus()
  }, [loadStatus])

  async function disconnect() {
    setDisconnecting(true)
    await fetch('/api/integrations/gmail/disconnect', { method: 'POST' })
    await loadStatus()
    setDisconnecting(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
    </div>
  )

  return (
    <div className="space-y-4">
      {notice === 'connected' && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
          <CheckCircle className="h-4 w-4 text-emerald-400" />
          <p className="text-sm text-emerald-300">Gmail connected</p>
        </div>
      )}
      {notice === 'error' && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-red-400" />
          <p className="text-sm text-red-300">Couldn&apos;t connect Gmail. Please try again.</p>
        </div>
      )}

      <div className="rounded-xl border border-white/8 bg-white/3 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/20">
              {status?.connected
                ? <MailCheck className="h-4 w-4 text-sky-400" />
                : <Mail className="h-4 w-4 text-slate-500" />}
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Bank Email Sync</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {status?.connected
                  ? `Watching ${status.gmailEmail} for Axis Bank alerts`
                  : 'Auto-import Axis Bank alert emails as transactions'}
              </p>
            </div>
          </div>
        </div>

        {!status?.connected && (
          <div className="rounded-lg border border-sky-500/15 bg-sky-500/5 px-3 py-3 space-y-1.5">
            <p className="text-xs font-medium text-sky-400">How it works</p>
            <ol className="space-y-1 text-[11px] text-slate-400 list-decimal list-inside">
              <li>Connect the Gmail inbox that receives your Axis Bank alerts</li>
              <li>We only ever read mail from <span className="text-sky-300 font-medium">alerts@axis.bank.in</span> (read-only access)</li>
              <li>New debit/credit alerts are parsed and added to your transactions automatically, every 30 minutes</li>
            </ol>
          </div>
        )}

        {status?.connected && status.lastSyncedAt && (
          <p className="text-xs text-slate-500">
            Last synced {formatDistanceToNow(new Date(status.lastSyncedAt), { addSuffix: true })}
          </p>
        )}

        {status?.connected ? (
          <Button
            variant="outline"
            size="sm"
            onClick={disconnect}
            disabled={disconnecting}
            className="border-white/10 bg-white/5 text-slate-300 hover:text-red-400 hover:border-red-500/30 text-xs h-8"
          >
            {disconnecting
              ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Disconnecting...</>
              : <><Unplug className="mr-1.5 h-3.5 w-3.5" /> Disconnect Gmail</>}
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => { window.location.href = '/api/integrations/gmail/connect' }}
            className="bg-violet-600 hover:bg-violet-700 text-white text-xs h-8"
          >
            <Mail className="mr-1.5 h-3.5 w-3.5" /> Connect Gmail
          </Button>
        )}
      </div>
    </div>
  )
}
