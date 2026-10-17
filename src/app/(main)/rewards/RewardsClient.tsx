'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Flame, Plus, Trash2, Pencil, Gift, Loader2, AlertCircle, Sparkles, Snowflake } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FREEZE_COST, FREEZE_MAX } from '@/lib/dailyChest'
import CountUp from '@/components/ui/count-up'
import EmptyState from '@/components/ui/empty-state'
import PointsOverview from '@/components/rewards/PointsOverview'
import ListClearedBurst from '@/components/shared/ListClearedBurst'
import { daysToAfford } from '@/lib/pointsSummary'
import { haptic } from '@/lib/effects'

interface CatalogItem { id: string; title: string; point_cost: number; created_at: string }
interface Redemption  { id: string; title: string; point_cost: number; redeemed_at: string }
interface HabitStreak { id: string; habit_name: string; streak_count: number }

// Offered as one-tap ideas (any not already in the catalog), and all at
// once to an empty catalog.
const STARTER_CATALOG = [
  { title: '☕ Favourite coffee or snack',          point_cost: 100 },
  { title: '🍨 Dessert or ice cream treat',         point_cost: 200 },
  { title: '🎬 Movie night',                        point_cost: 400 },
  { title: '🍽️ Lunch out with family or friends',  point_cost: 600 },
  { title: '👕 New clothes',                        point_cost: 1500 },
  { title: '🎧 Gadget or gear you\'ve wanted',      point_cost: 2500 },
  { title: '✈️ Weekend getaway',                    point_cost: 5000 },
]

export default function RewardsClient({
  pointsBalance, currentPerfectStreak, longestPerfectStreak,
  catalog: initialCatalog, redemptions: initialRedemptions, streaks, streakFreezes,
}: {
  pointsBalance: number
  currentPerfectStreak: number
  longestPerfectStreak: number
  catalog: CatalogItem[]
  redemptions: Redemption[]
  streaks: HabitStreak[]
  streakFreezes: number | null   // null: freezes not available (migration 049 not applied)
}) {
  const [freezes, setFreezes]         = useState(streakFreezes ?? 0)
  const [buyingFreeze, setBuyingFreeze] = useState(false)
  const [balance, setBalance]         = useState(pointsBalance)
  const [catalog, setCatalog]         = useState(initialCatalog)
  const [redemptions, setRedemptions] = useState(initialRedemptions)
  const [seeding, setSeeding]         = useState(false)
  const [seeded, setSeeded]           = useState(catalog.length > 0)

  const [newTitle, setNewTitle] = useState('')
  const [newCost, setNewCost]   = useState('')
  const [adding, setAdding]     = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editCost, setEditCost]   = useState('')

  const [redeemingId, setRedeemingId] = useState<string | null>(null)
  const [deletingId, setDeletingId]   = useState<string | null>(null)
  const [error, setError]             = useState<string | null>(null)
  // Bumped after spending so the points breakdown reloads.
  const [ledgerKey, setLedgerKey]     = useState(0)
  // Points per day lately — for "about N days to go" on locked rewards.
  const [pace, setPace]               = useState<number | null>(null)
  const [celebrating, setCelebrating] = useState<string | null>(null)
  useEffect(() => {
    if (!celebrating) return
    const t = setTimeout(() => setCelebrating(null), 2200)
    return () => clearTimeout(t)
  }, [celebrating])
  const [addingIdea, setAddingIdea]   = useState<string | null>(null)

  async function seedStarters() {
    setSeeding(true)
    const created: CatalogItem[] = []
    for (const item of STARTER_CATALOG) {
      const res  = await fetch('/api/rewards/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      })
      const data = await res.json()
      if (data.reward) created.push(data.reward)
    }
    setCatalog(created)
    setSeeded(true)
    setSeeding(false)
  }

  async function addReward() {
    const cost = Number(newCost)
    if (!newTitle.trim() || !cost || cost <= 0) return
    setAdding(true)
    setError(null)
    const res  = await fetch('/api/rewards/catalog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle.trim(), point_cost: cost }),
    })
    const data = await res.json()
    if (data.reward) {
      setCatalog(prev => [...prev, data.reward].sort((a, b) => a.point_cost - b.point_cost))
      setNewTitle(''); setNewCost('')
    } else {
      setError(data.error ?? 'Failed to add reward')
    }
    setAdding(false)
  }

  async function addIdea(idea: { title: string; point_cost: number }) {
    setAddingIdea(idea.title)
    setError(null)
    const res  = await fetch('/api/rewards/catalog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(idea),
    })
    const data = await res.json()
    if (data.reward) setCatalog(prev => [...prev, data.reward].sort((a, b) => a.point_cost - b.point_cost))
    else setError(data.error ?? 'Failed to add reward')
    setAddingIdea(null)
  }

  function startEdit(item: CatalogItem) {
    setEditingId(item.id); setEditTitle(item.title); setEditCost(String(item.point_cost))
  }

  async function saveEdit(id: string) {
    const cost = Number(editCost)
    if (!editTitle.trim() || !cost || cost <= 0) return
    const res  = await fetch(`/api/rewards/catalog?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: editTitle.trim(), point_cost: cost }),
    })
    const data = await res.json()
    if (data.reward) {
      setCatalog(prev => prev.map(c => c.id === id ? data.reward : c).sort((a, b) => a.point_cost - b.point_cost))
      setEditingId(null)
    } else {
      setError(data.error ?? 'Failed to save changes')
    }
  }

  async function deleteReward(id: string) {
    setDeletingId(id)
    await fetch(`/api/rewards/catalog?id=${id}`, { method: 'DELETE' })
    setCatalog(prev => prev.filter(c => c.id !== id))
    setDeletingId(null)
  }

  async function redeem(item: CatalogItem) {
    if (balance < item.point_cost || redeemingId) return
    setRedeemingId(item.id)
    setError(null)
    const res  = await fetch('/api/rewards/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ catalog_id: item.id }),
    })
    const data = await res.json()
    if (data.redemption) {
      setBalance(prev => prev - item.point_cost)
      setRedemptions(prev => [data.redemption, ...prev])
      setLedgerKey(k => k + 1)
      setCelebrating(item.title)
      haptic('success')
    } else {
      setError(data.error ?? 'Failed to redeem')
    }
    setRedeemingId(null)
  }

  async function buyFreeze() {
    if (buyingFreeze || balance < FREEZE_COST || freezes >= FREEZE_MAX) return
    setBuyingFreeze(true)
    setError(null)
    const res = await fetch('/api/rewards/buy-freeze', { method: 'POST' })
    if (res.ok) {
      setBalance(prev => prev - FREEZE_COST)
      setFreezes(prev => prev + 1)
      setLedgerKey(k => k + 1)
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Could not buy a streak freeze')
    }
    setBuyingFreeze(false)
  }

  const ready    = catalog.filter(c => c.point_cost <= balance)
  const upcoming = catalog.filter(c => c.point_cost > balance)
  const ideas    = STARTER_CATALOG.filter(i => !catalog.some(c => c.title === i.title))

  function renderItem(item: CatalogItem, isReady: boolean) {
    if (editingId === item.id) {
      return (
        <div key={item.id} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5">
          <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
            className="flex-1 rounded-lg border border-white/20 bg-white/5 px-2 py-1 text-sm text-white" />
          <input type="number" value={editCost} onChange={e => setEditCost(e.target.value)}
            className="w-20 rounded-lg border border-white/20 bg-white/5 px-2 py-1 text-sm text-white" />
          <button onClick={() => saveEdit(item.id)} className="text-xs text-emerald-400">Save</button>
        </div>
      )
    }
    const toGo = item.point_cost - balance
    const days = daysToAfford(item.point_cost, balance, pace ?? 0)
    return (
      <div
        key={item.id}
        className={cn(
          'rounded-xl border px-3 py-2.5 transition-colors',
          isReady
            ? 'border-amber-500/40 bg-gradient-to-r from-amber-500/15 to-amber-500/[0.03] shadow-[0_0_18px_-6px_rgba(245,158,11,0.45)]'
            : 'border-white/10 bg-white/5',
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white">{item.title}</p>
            <p className="text-[11px] text-slate-500">{item.point_cost.toLocaleString()} pts</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={() => startEdit(item)} className="p-1.5 text-slate-500 hover:text-white transition-colors" aria-label="Edit">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => deleteReward(item.id)} disabled={deletingId === item.id} className="p-1.5 text-slate-500 hover:text-red-400 transition-colors disabled:opacity-50" aria-label="Delete">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => redeem(item)}
              disabled={!isReady || redeemingId === item.id}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all active:scale-95',
                isReady ? 'bg-amber-500 hover:bg-amber-600 text-snow' : 'bg-white/5 text-slate-600',
              )}
            >
              {redeemingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Gift className="h-3.5 w-3.5" />}
              Redeem
            </button>
          </div>
        </div>
        {!isReady && (
          <div className="mt-2">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300 transition-[width] duration-700"
                style={{ width: `${Math.max(2, Math.min(100, (balance / item.point_cost) * 100))}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              <span className="text-slate-300">{toGo.toLocaleString()} pts to go</span>
              {days !== null && days > 0 && <> · about {days} day{days === 1 ? '' : 's'} at your pace</>}
            </p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Rewards</h1>
        <p className="text-slate-400 text-sm mt-1">Turn consistent habits into real-world celebrations</p>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      <PointsOverview balance={balance} refreshKey={ledgerKey} onLedger={l => setPace(l.summary.dailyPace)} />

      {celebrating && typeof document !== 'undefined' && createPortal(
        <ListClearedBurst title={`Enjoy: ${celebrating}`} subtitle="You earned this. Have a great time!" emoji="🎁" />,
        document.body,
      )}

      <div className="flex items-center gap-3 rounded-xl border border-orange-500/20 bg-orange-500/5 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-500/15">
          <Flame className="h-5 w-5 text-orange-400" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-medium text-orange-400">Perfect Day Streak</p>
          <p className="text-[11px] text-slate-500">Best: {longestPerfectStreak}</p>
        </div>
        <p className="text-3xl font-bold text-white"><CountUp value={currentPerfectStreak} /></p>
      </div>

      {streakFreezes !== null && (
        <div className="flex items-center gap-3 rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/15">
            <Snowflake className="h-5 w-5 text-sky-300" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">
              Streak freezes <span className="text-sky-300">{freezes}/{FREEZE_MAX}</span>
            </p>
            <p className="text-[11px] text-slate-400 leading-snug">
              Miss one day and a freeze is used automatically when you&apos;re back. It covers every streak, including your perfect-day streak.
            </p>
          </div>
          <button
            type="button"
            onClick={buyFreeze}
            disabled={buyingFreeze || balance < FREEZE_COST || freezes >= FREEZE_MAX}
            className={cn(
              'shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition-all',
              balance >= FREEZE_COST && freezes < FREEZE_MAX
                ? 'bg-sky-600 hover:bg-sky-700 text-snow'
                : 'bg-white/5 text-slate-600',
            )}
          >
            {buyingFreeze
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : freezes >= FREEZE_MAX ? 'Full' : `Buy · ${FREEZE_COST}`}
          </button>
        </div>
      )}

      {streaks.length > 0 && (
        <div className="rounded-xl border border-white/8 bg-white/3 p-4 space-y-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Streaks</p>
          <div className="space-y-1.5">
            {streaks.map(h => (
              <div key={h.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-300">{h.habit_name}</span>
                <span className="flex items-center gap-1 text-orange-400 font-semibold">
                  <Flame className="h-3.5 w-3.5" /> {h.streak_count}d
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-white/8 bg-white/3 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Reward Catalog</p>
          {catalog.length === 0 && !seeded && (
            <button onClick={seedStarters} disabled={seeding} className="text-xs text-amber-400 hover:text-amber-300 disabled:opacity-50">
              {seeding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Add starter rewards'}
            </button>
          )}
        </div>

        {catalog.length === 0 && seeded && (
          <EmptyState
            icon={Gift}
            tone="amber"
            title="No rewards yet"
            hint="Add something worth working for below, and spend your points on it."
            className="py-8"
          />
        )}

        {ready.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-amber-300">🎉 Ready to enjoy</p>
            {ready.map(item => renderItem(item, true))}
          </div>
        )}
        {upcoming.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-400">Next up</p>
            {upcoming.map(item => renderItem(item, false))}
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <input placeholder="New reward…" value={newTitle} onChange={e => setNewTitle(e.target.value)}
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-600" />
          <input placeholder="Cost" type="number" value={newCost} onChange={e => setNewCost(e.target.value)}
            className="w-20 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-600" />
          <button onClick={addReward} disabled={adding} className="p-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-snow disabled:opacity-50">
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </button>
        </div>

        {catalog.length > 0 && ideas.length > 0 && (
          <div className="pt-1">
            <p className="mb-1.5 text-[11px] text-slate-500">Ideas, tap to add:</p>
            <div className="flex flex-wrap gap-1.5">
              {ideas.map(idea => (
                <button
                  key={idea.title}
                  type="button"
                  onClick={() => addIdea(idea)}
                  disabled={addingIdea !== null}
                  className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-slate-300 hover:border-amber-500/40 hover:text-white disabled:opacity-50 transition-colors"
                >
                  {addingIdea === idea.title ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                  {idea.title} · {idea.point_cost.toLocaleString()}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {redemptions.length > 0 && (
        <div className="rounded-xl border border-white/8 bg-white/3 p-4 space-y-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Redemption History</p>
          <div className="space-y-1.5">
            {redemptions.map(r => (
              <div key={r.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-300">{r.title}</span>
                <span className="text-slate-500">-{r.point_cost} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
