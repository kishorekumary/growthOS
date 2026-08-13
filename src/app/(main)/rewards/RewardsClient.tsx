'use client'

import { useState } from 'react'
import { Coins, Flame, Plus, Trash2, Pencil, Gift, Loader2, AlertCircle, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CatalogItem { id: string; title: string; point_cost: number; created_at: string }
interface Redemption  { id: string; title: string; point_cost: number; redeemed_at: string }
interface HabitStreak { id: string; habit_name: string; streak_count: number }

const STARTER_CATALOG = [
  { title: '☕ Treat yourself to a coffee', point_cost: 100 },
  { title: '🍽️ Dinner out',                point_cost: 300 },
  { title: '🎬 Movie night',                point_cost: 500 },
  { title: '🏖️ Small day trip',             point_cost: 2500 },
  { title: '✈️ Weekend getaway',            point_cost: 5000 },
]

export default function RewardsClient({
  pointsBalance, currentPerfectStreak, longestPerfectStreak,
  catalog: initialCatalog, redemptions: initialRedemptions, streaks,
}: {
  pointsBalance: number
  currentPerfectStreak: number
  longestPerfectStreak: number
  catalog: CatalogItem[]
  redemptions: Redemption[]
  streaks: HabitStreak[]
}) {
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
    } else {
      setError(data.error ?? 'Failed to redeem')
    }
    setRedeemingId(null)
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

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 text-amber-400">
            <Coins className="h-4 w-4" />
            <p className="text-xs font-medium">Points Balance</p>
          </div>
          <p className="text-3xl font-bold text-white mt-1">{balance}</p>
        </div>
        <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4">
          <div className="flex items-center gap-2 text-orange-400">
            <Flame className="h-4 w-4" />
            <p className="text-xs font-medium">Perfect Day Streak</p>
          </div>
          <p className="text-3xl font-bold text-white mt-1">{currentPerfectStreak}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Best: {longestPerfectStreak}</p>
        </div>
      </div>

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
          <p className="text-sm text-slate-500 text-center py-4">No rewards yet — add your first one below.</p>
        )}

        <div className="space-y-2">
          {catalog.map(item => (
            <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5">
              {editingId === item.id ? (
                <div className="flex-1 flex items-center gap-2">
                  <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                    className="flex-1 rounded-lg border border-white/20 bg-white/5 px-2 py-1 text-sm text-white" />
                  <input type="number" value={editCost} onChange={e => setEditCost(e.target.value)}
                    className="w-20 rounded-lg border border-white/20 bg-white/5 px-2 py-1 text-sm text-white" />
                  <button onClick={() => saveEdit(item.id)} className="text-xs text-emerald-400">Save</button>
                </div>
              ) : (
                <>
                  <div className="flex-1">
                    <p className="text-sm text-white">{item.title}</p>
                    <p className="text-[11px] text-slate-500">{item.point_cost} pts</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => startEdit(item)} className="p-1.5 text-slate-500 hover:text-white transition-colors">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => deleteReward(item.id)} disabled={deletingId === item.id} className="p-1.5 text-slate-500 hover:text-red-400 transition-colors disabled:opacity-50">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => redeem(item)}
                      disabled={balance < item.point_cost || redeemingId === item.id}
                      className={cn(
                        'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all',
                        balance >= item.point_cost ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-white/5 text-slate-600'
                      )}
                    >
                      {redeemingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Gift className="h-3.5 w-3.5" />}
                      Redeem
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input placeholder="New reward…" value={newTitle} onChange={e => setNewTitle(e.target.value)}
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-600" />
          <input placeholder="Cost" type="number" value={newCost} onChange={e => setNewCost(e.target.value)}
            className="w-20 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-600" />
          <button onClick={addReward} disabled={adding} className="p-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50">
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </button>
        </div>
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
