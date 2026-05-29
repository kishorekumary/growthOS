'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Users, Globe, Flame, BookOpen, Dumbbell, Target,
  CheckSquare, Plus, Trash2, Loader2, Shield, ShieldOff,
  ChevronRight, Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface UserRow {
  id: string; email: string; full_name: string; avatar_url: string | null
  is_admin: boolean; joined: string
  habitCount: number; topStreak: number; weekDone: number; weekTotal: number
  booksReading: number; booksCompleted: number; workoutsWeek: number
  activeGoals: number; openTodos: number
}

interface GlobalHabit {
  id: string; habit_name: string; category: string; frequency: string; created_at: string
}

const CATEGORY_COLOR: Record<string, string> = {
  mindset:      'text-violet-300 bg-violet-500/15',
  social:       'text-sky-300 bg-sky-500/15',
  productivity: 'text-emerald-300 bg-emerald-500/15',
}

export default function AdminDashboard({
  users: initialUsers,
  globalHabits: initialGlobalHabits,
  meId,
}: {
  users: UserRow[]
  globalHabits: GlobalHabit[]
  meId: string
}) {
  const [tab, setTab]                 = useState<'users' | 'global'>('users')
  const [search, setSearch]           = useState('')
  const [users, setUsers]             = useState(initialUsers)
  const [globalHabits, setGlobalHabits] = useState(initialGlobalHabits)
  const [togglingId, setTogglingId]   = useState<string | null>(null)
  const [deletingId, setDeletingId]   = useState<string | null>(null)
  const [addingHabit, setAddingHabit] = useState(false)
  const [newHabit, setNewHabit]       = useState({ habit_name: '', category: 'mindset', frequency: 'daily' })

  const filtered = users.filter(u =>
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  async function toggleAdmin(u: UserRow) {
    setTogglingId(u.id)
    const res = await fetch('/api/admin/set-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: u.id, is_admin: !u.is_admin }),
    })
    if (res.ok) setUsers(prev => prev.map(x => x.id === u.id ? { ...x, is_admin: !u.is_admin } : x))
    setTogglingId(null)
  }

  async function deleteGlobalHabit(id: string) {
    setDeletingId(id)
    await fetch(`/api/admin/global-habits?id=${id}`, { method: 'DELETE' })
    setGlobalHabits(prev => prev.filter(h => h.id !== id))
    setDeletingId(null)
  }

  async function addGlobalHabit() {
    if (!newHabit.habit_name.trim()) return
    setAddingHabit(true)
    const res = await fetch('/api/admin/global-habits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newHabit),
    })
    const data = await res.json()
    if (data.habit) setGlobalHabits(prev => [data.habit, ...prev])
    setNewHabit({ habit_name: '', category: 'mindset', frequency: 'daily' })
    setAddingHabit(false)
  }

  const totalUsers   = users.length
  const adminCount   = users.filter(u => u.is_admin).length
  const totalGlobal  = globalHabits.length
  const activeThisWk = users.filter(u => u.weekDone > 0).length

  return (
    <div className="min-h-screen p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage users, monitor progress, and set global habits</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Users',     value: totalUsers,   icon: Users,  color: 'text-indigo-400' },
          { label: 'Admins',          value: adminCount,   icon: Shield, color: 'text-violet-400' },
          { label: 'Active This Week', value: activeThisWk, icon: Flame,  color: 'text-orange-400' },
          { label: 'Global Habits',   value: totalGlobal,  icon: Globe,  color: 'text-emerald-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 flex items-center gap-3">
            <div className={cn('p-2 rounded-lg bg-white/[0.05]', color)}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xl font-bold text-white">{value}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/[0.06]">
        {(['users', 'global'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              tab === t
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-500 hover:text-slate-300',
            )}
          >
            {t === 'users' ? `Users (${totalUsers})` : `Global Habits (${totalGlobal})`}
          </button>
        ))}
      </div>

      {/* Users tab */}
      {tab === 'users' && (
        <div className="space-y-4">
          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search users…"
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50"
            />
          </div>

          {/* Table */}
          <div className="rounded-xl border border-white/[0.06] overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-slate-500 text-xs">
                  <th className="text-left px-4 py-3 font-medium">User</th>
                  <th className="text-center px-3 py-3 font-medium">Habits</th>
                  <th className="text-center px-3 py-3 font-medium">This Week</th>
                  <th className="text-center px-3 py-3 font-medium hidden md:table-cell">Streak</th>
                  <th className="text-center px-3 py-3 font-medium hidden lg:table-cell">Books</th>
                  <th className="text-center px-3 py-3 font-medium hidden lg:table-cell">Workouts</th>
                  <th className="text-center px-3 py-3 font-medium hidden lg:table-cell">Goals</th>
                  <th className="text-center px-3 py-3 font-medium hidden lg:table-cell">Todos</th>
                  <th className="text-right px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => {
                  const initials = u.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || u.email[0].toUpperCase()
                  const pct = u.weekTotal > 0 ? Math.round((u.weekDone / u.weekTotal) * 100) : null
                  return (
                    <tr key={u.id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {u.avatar_url ? (
                            <img src={u.avatar_url} alt={u.full_name} className="h-8 w-8 rounded-full object-cover ring-1 ring-white/10" />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-indigo-500/20 ring-1 ring-indigo-500/30 flex items-center justify-center text-[11px] font-semibold text-indigo-300">
                              {initials}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-white font-medium truncate">{u.full_name || '—'}</span>
                              {u.is_admin && <Shield className="h-3 w-3 text-violet-400 shrink-0" />}
                            </div>
                            <span className="text-slate-500 text-xs truncate block">{u.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center text-slate-300">{u.habitCount}</td>
                      <td className="px-3 py-3 text-center">
                        {pct !== null ? (
                          <span className={cn('font-medium', pct >= 70 ? 'text-emerald-400' : pct >= 40 ? 'text-amber-400' : 'text-red-400')}>
                            {pct}%
                          </span>
                        ) : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-3 py-3 text-center text-slate-300 hidden md:table-cell">
                        {u.topStreak > 0 ? (
                          <span className="flex items-center justify-center gap-1">
                            <Flame className="h-3.5 w-3.5 text-orange-400" />{u.topStreak}
                          </span>
                        ) : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-3 py-3 text-center hidden lg:table-cell">
                        <span className="text-slate-300">{u.booksReading > 0 ? `${u.booksReading} reading` : ''}</span>
                        {u.booksCompleted > 0 && <span className="text-slate-500 text-xs block">{u.booksCompleted} done</span>}
                        {u.booksReading === 0 && u.booksCompleted === 0 && <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-3 py-3 text-center text-slate-300 hidden lg:table-cell">
                        {u.workoutsWeek > 0 ? u.workoutsWeek : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-3 py-3 text-center text-slate-300 hidden lg:table-cell">
                        {u.activeGoals > 0 ? u.activeGoals : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-3 py-3 text-center text-slate-300 hidden lg:table-cell">
                        {u.openTodos > 0 ? u.openTodos : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {/* Can't demote yourself */}
                          {u.id !== meId && (
                            <button
                              onClick={() => toggleAdmin(u)}
                              disabled={togglingId === u.id}
                              title={u.is_admin ? 'Revoke admin' : 'Make admin'}
                              className={cn(
                                'flex items-center justify-center w-7 h-7 rounded-md border transition-colors',
                                u.is_admin
                                  ? 'border-violet-500/40 text-violet-400 hover:bg-violet-500/10'
                                  : 'border-white/10 text-slate-500 hover:text-violet-400 hover:border-violet-500/30',
                              )}
                            >
                              {togglingId === u.id
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : u.is_admin
                                  ? <ShieldOff className="h-3.5 w-3.5" />
                                  : <Shield className="h-3.5 w-3.5" />}
                            </button>
                          )}
                          <Link
                            href={`/admin/users/${u.id}`}
                            className="flex items-center justify-center w-7 h-7 rounded-md border border-white/10 text-slate-500 hover:text-white hover:border-white/20 transition-colors"
                          >
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-500 text-sm">No users found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Global Habits tab */}
      {tab === 'global' && (
        <div className="space-y-4 max-w-2xl">
          <p className="text-sm text-slate-400">
            Global habits appear in every user's habit tracker. Users can mark them done or missed but cannot edit or delete them.
          </p>

          {/* Add habit form */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
            <p className="text-sm font-medium text-white">Add Global Habit</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={newHabit.habit_name}
                onChange={e => setNewHabit(p => ({ ...p, habit_name: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && addGlobalHabit()}
                placeholder="Habit name…"
                className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50"
              />
              <select
                value={newHabit.category}
                onChange={e => setNewHabit(p => ({ ...p, category: e.target.value }))}
                className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-indigo-500/50"
              >
                <option value="mindset">Mindset</option>
                <option value="social">Social</option>
                <option value="productivity">Productivity</option>
              </select>
              <select
                value={newHabit.frequency}
                onChange={e => setNewHabit(p => ({ ...p, frequency: e.target.value }))}
                className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-indigo-500/50"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
              <button
                onClick={addGlobalHabit}
                disabled={addingHabit || !newHabit.habit_name.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
              >
                {addingHabit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add
              </button>
            </div>
          </div>

          {/* Global habits list */}
          {globalHabits.length === 0 ? (
            <div className="rounded-xl border border-white/[0.06] p-8 text-center">
              <Globe className="h-8 w-8 text-slate-700 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No global habits yet. Add one above.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {globalHabits.map(h => (
                <div key={h.id} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                  <Globe className="h-4 w-4 text-emerald-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-white">{h.habit_name}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={cn('text-[11px] px-1.5 py-0.5 rounded font-medium', CATEGORY_COLOR[h.category] ?? 'text-slate-400 bg-white/5')}>
                        {h.category}
                      </span>
                      <span className="text-[11px] text-slate-600">{h.frequency}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteGlobalHabit(h.id)}
                    disabled={deletingId === h.id}
                    className="flex items-center justify-center w-7 h-7 rounded-md border border-white/10 text-slate-500 hover:text-red-400 hover:border-red-500/30 transition-colors"
                  >
                    {deletingId === h.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
