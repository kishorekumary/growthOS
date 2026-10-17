'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Gift, Loader2 } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { POINTS_CHANGED_EVENT, notifyPointsChanged } from '@/lib/pointsEvents'
import { findUnlocks, type UnlockCandidate } from '@/lib/rewardUnlocks'
import { haptic } from '@/lib/effects'
import ListClearedBurst from './ListClearedBurst'

const SEEN_KEY = 'growthos:rewards-affordable'
// Let the check-off's own coin burst / milestone popup land first.
const DELAY_MS = 1200

function readSeen(): Set<string> | null {
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    return raw === null ? null : new Set(JSON.parse(raw) as string[])
  } catch { return null }
}
function writeSeen(ids: string[]) {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(ids)) } catch {}
}

// "You've earned it" popup: when the balance crosses a catalog reward's
// cost, offer to redeem it right away. Mounted once in the main layout;
// re-checks whenever points change (see pointsEvents).
export default function RewardUnlockModal() {
  const [unlocked, setUnlocked] = useState<UnlockCandidate[]>([])
  const [redeeming, setRedeeming] = useState(false)
  const [redeemed, setRedeemed] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const check = useCallback(async () => {
    const db = createSupabaseBrowserClient()
    const [{ data: rewards }, { data: catalog }] = await Promise.all([
      db.from('user_rewards').select('points_balance').maybeSingle(),
      db.from('reward_catalog').select('id, title, point_cost'),
    ])
    if (!catalog) return
    const { announce, nextSeen } = findUnlocks(catalog, rewards?.points_balance ?? 0, readSeen())
    writeSeen(nextSeen)
    if (announce.length) {
      setUnlocked(announce)
      setRedeemed(false)
      setError(null)
      haptic('success')
    }
  }, [])

  useEffect(() => {
    check()
    let timer: ReturnType<typeof setTimeout>
    const onChange = () => { clearTimeout(timer); timer = setTimeout(check, DELAY_MS) }
    window.addEventListener(POINTS_CHANGED_EVENT, onChange)
    return () => { clearTimeout(timer); window.removeEventListener(POINTS_CHANGED_EVENT, onChange) }
  }, [check])

  const reward = unlocked[0]
  if (!reward) return null
  const more = unlocked.length - 1
  const close = () => setUnlocked([])

  async function redeem() {
    setRedeeming(true)
    setError(null)
    const res = await fetch('/api/rewards/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ catalog_id: reward.id }),
    })
    setRedeeming(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Could not redeem')
      return
    }
    setRedeemed(true)
    haptic('success')
    notifyPointsChanged()
  }

  return (
    <div className="sheet-in fixed inset-0 z-[210] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={close}>
      <ListClearedBurst key={redeemed ? 'redeemed' : reward.id} card={false} />
      <div
        role="dialog"
        aria-label="Reward unlocked"
        onClick={e => e.stopPropagation()}
        className="card-sheen relative w-full max-w-sm overflow-hidden rounded-2xl border border-amber-500/40 bg-slate-900 p-6 text-center shadow-2xl"
      >
        <div aria-hidden className="pointer-events-none absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-amber-500/30 blur-3xl" />
        <div className="relative mx-auto flex h-16 w-16 animate-pop items-center justify-center rounded-2xl border border-amber-500/40 bg-amber-500/15 text-3xl">
          {redeemed ? '🎁' : '🎉'}
        </div>
        <p className="relative mt-4 text-xs font-semibold uppercase tracking-wider text-amber-400">
          {redeemed ? 'Enjoy it!' : 'Reward unlocked'}
        </p>
        <p className="relative mt-1 text-xl font-bold text-white">{reward.title}</p>
        <p className="relative mt-2 text-sm text-slate-400">
          {redeemed
            ? 'Go treat yourself. You earned every point of it.'
            : `Your habits earned you this. ${reward.point_cost.toLocaleString()} points, ready to spend.`}
        </p>
        {error && <p className="relative mt-2 text-xs text-red-400">{error}</p>}

        <div className="relative mt-5 flex flex-col gap-2">
          {redeemed ? (
            <button onClick={close} className="rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-snow hover:bg-amber-600 active:scale-[0.98] transition">
              Done
            </button>
          ) : (
            <>
              <button
                onClick={redeem}
                disabled={redeeming}
                className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-snow hover:bg-amber-600 active:scale-[0.98] disabled:opacity-60 transition"
              >
                {redeeming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
                Redeem now
              </button>
              <button onClick={close} className="rounded-xl py-2 text-sm text-slate-400 hover:text-white transition-colors">
                Save it for later
              </button>
            </>
          )}
          {more > 0 && (
            <Link href="/rewards" onClick={close} className="text-xs text-amber-300/80 hover:text-amber-300">
              + {more} more reward{more === 1 ? '' : 's'} ready to enjoy →
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
