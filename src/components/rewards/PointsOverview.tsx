'use client'

import { useEffect, useState } from 'react'
import { formatDistanceToNowStrict, subDays } from 'date-fns'
import { ChevronDown, ChevronUp, Coins } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { summarizePoints, type PointsLogRow, type PointsSummary } from '@/lib/pointsSummary'
import CountUp from '@/components/ui/count-up'
import { Skeleton } from '@/components/ui/skeleton'

export interface PointsLedger {
  summary:  PointsSummary
  activity: PointsLogRow[]
}

// Reads the ledger in the browser so "today" and "this week" use the
// device's timezone. RLS limits every query to the signed-in user's rows.
export async function loadPointsLedger(balance: number): Promise<PointsLedger> {
  const db = createSupabaseBrowserClient()
  const log = () => db.from('reward_points_log').select('delta, reason, created_at')
  const [recent, activity, redeemed, bought] = await Promise.all([
    log().gte('created_at', subDays(new Date(), 8).toISOString()).order('created_at', { ascending: false }).limit(1000),
    log().order('created_at', { ascending: false }).limit(15),
    log().lt('delta', 0).like('reason', 'Redeemed:%'),
    log().lt('delta', 0).like('reason', 'Bought:%'),
  ])
  const spent = [...(redeemed.data ?? []), ...(bought.data ?? [])].reduce((s, r) => s - r.delta, 0)
  return {
    summary:  summarizePoints(recent.data ?? [], balance, spent),
    activity: activity.data ?? [],
  }
}

// The Rewards page header: balance, what was earned today / this week /
// ever, and the latest point changes. `refreshKey` reloads after spending.
export default function PointsOverview({ balance, refreshKey, onLedger }: {
  balance:    number
  refreshKey: number
  onLedger?:  (ledger: PointsLedger) => void
}) {
  const [ledger, setLedger] = useState<PointsLedger | null>(null)
  const [showActivity, setShowActivity] = useState(false)

  useEffect(() => {
    let live = true
    loadPointsLedger(balance)
      .then(l => { if (live) { setLedger(l); onLedger?.(l) } })
      .catch(() => { /* the balance still shows; the breakdown just stays hidden */ })
    return () => { live = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

  const s = ledger?.summary
  return (
    <div className="card-sheen relative overflow-hidden rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent p-5">
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-amber-500/25 blur-3xl" />

      <div className="relative flex items-center gap-2 text-amber-400">
        <Coins className="h-4 w-4" />
        <p className="text-xs font-semibold uppercase tracking-wider">Your points</p>
      </div>
      <p className="relative mt-1 text-4xl font-bold text-white">
        <CountUp value={balance} />
        <span className="ml-1.5 text-base font-medium text-slate-400">pts to spend</span>
      </p>

      <div className="relative mt-4 grid grid-cols-3 gap-2">
        {([
          ['Today',     s?.today],
          ['This week', s?.week],
          ['All-time',  s?.earnedAllTime],
        ] as const).map(([label, value]) => (
          <div key={label} className="rounded-xl bg-white/[0.04] px-3 py-2">
            <p className="text-[11px] text-slate-500">{label}</p>
            {value === undefined
              ? <Skeleton className="mt-1 h-5 w-12" />
              : <p className="text-base font-semibold text-white">
                  {label !== 'All-time' && value > 0 && '+'}<CountUp value={value} />
                </p>}
          </div>
        ))}
      </div>

      {ledger && ledger.activity.length > 0 && (
        <div className="relative mt-3">
          <button
            type="button"
            onClick={() => setShowActivity(v => !v)}
            className="flex items-center gap-1 text-xs font-medium text-amber-300/80 hover:text-amber-300"
          >
            {showActivity ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            Where your points came from
          </button>
          {showActivity && (
            <ul className="mt-2 space-y-1.5 animate-in fade-in-0 slide-in-from-top-1 duration-200">
              {ledger.activity.map((r, i) => (
                <li key={i} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 flex-1 truncate text-slate-300">{r.reason}</span>
                  <span className="shrink-0 text-[11px] text-slate-600">
                    {formatDistanceToNowStrict(new Date(r.created_at), { addSuffix: true })}
                  </span>
                  <span className={cn('w-14 shrink-0 text-right font-semibold tabular-nums', r.delta >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {r.delta >= 0 ? '+' : ''}{r.delta}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
