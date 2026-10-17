'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Coins, Gift } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { POINTS_CHANGED_EVENT } from '@/lib/pointsEvents'
import { daysToAfford } from '@/lib/pointsSummary'
import { loadPointsLedger, type PointsLedger } from '@/components/rewards/PointsOverview'
import CountUp from '@/components/ui/count-up'

interface Reward { id: string; title: string; point_cost: number }

// Dashboard: what your points are worth right now — rewards ready to enjoy
// and progress toward the next one. Updates as habits are checked off.
export default function RewardsProgressCard() {
  const [state, setState] = useState<{ balance: number; catalog: Reward[]; ledger: PointsLedger | null } | null>(null)

  const load = useCallback(async () => {
    const db = createSupabaseBrowserClient()
    const [{ data: rewards }, { data: catalog }] = await Promise.all([
      db.from('user_rewards').select('points_balance').maybeSingle(),
      db.from('reward_catalog').select('id, title, point_cost').order('point_cost', { ascending: true }),
    ])
    const balance = rewards?.points_balance ?? 0
    const ledger = await loadPointsLedger(balance).catch(() => null)
    setState({ balance, catalog: catalog ?? [], ledger })
  }, [])

  useEffect(() => {
    load()
    window.addEventListener(POINTS_CHANGED_EVENT, load)
    return () => window.removeEventListener(POINTS_CHANGED_EVENT, load)
  }, [load])

  if (!state) return null
  const { balance, catalog, ledger } = state
  const ready = catalog.filter(c => c.point_cost <= balance)
  const next  = catalog.find(c => c.point_cost > balance)
  const today = ledger?.summary.today ?? 0
  const days  = next ? daysToAfford(next.point_cost, balance, ledger?.summary.dailyPace ?? 0) : null

  return (
    <Link
      href="/rewards"
      className="card-sheen group relative block overflow-hidden rounded-xl border border-amber-500/25 bg-gradient-to-br from-amber-500/15 to-amber-500/[0.03] p-4 transition-transform active:scale-[0.99]"
    >
      <div aria-hidden className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-amber-500/25 blur-2xl" />

      <div className="relative flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Coins className="h-4 w-4 text-amber-400" />
          <span className="text-2xl font-bold text-white"><CountUp value={balance} /></span>
          <span className="text-xs text-slate-400">points</span>
        </div>
        {today !== 0 && (
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
            {today > 0 ? '+' : ''}{today} today
          </span>
        )}
      </div>

      {ready.length > 0 && (
        <p className="relative mt-2 flex items-center gap-1.5 text-sm text-amber-200">
          <Gift className="h-4 w-4 shrink-0 text-amber-400" />
          <span className="min-w-0 truncate">
            {ready.length === 1
              ? <>Ready to enjoy: <b className="font-semibold">{ready[ready.length - 1].title}</b></>
              : <><b className="font-semibold">{ready.length} rewards</b> ready to enjoy 🎉</>}
          </span>
        </p>
      )}

      {next ? (
        <div className="relative mt-3">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="min-w-0 truncate text-slate-300">Next: {next.title}</span>
            <span className="shrink-0 text-slate-500">{(next.point_cost - balance).toLocaleString()} to go</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300 transition-[width] duration-700"
              style={{ width: `${Math.max(2, Math.min(100, (balance / next.point_cost) * 100))}%` }}
            />
          </div>
          {days !== null && days > 0 && (
            <p className="mt-1 text-[11px] text-slate-500">About {days} day{days === 1 ? '' : 's'} at your current pace</p>
          )}
        </div>
      ) : catalog.length === 0 && (
        <p className="relative mt-2 flex items-center gap-1 text-xs text-amber-300/80">
          Pick rewards worth working for <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </p>
      )}
    </Link>
  )
}
