'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import {
  Users, Globe, Flame, BookOpen, Dumbbell, Target,
  CheckSquare, Plus, Trash2, Loader2, Shield, ShieldOff,
  ChevronRight, Search, ShieldCheck, Image, FileText, Music, Video, X,
  Send, MessageSquare, Pencil,
} from 'lucide-react'
import { HABIT_CATEGORIES, HABIT_CATEGORY_META } from '@/lib/habitCategories'
import { cn } from '@/lib/utils'

type Role = 'user' | 'admin' | 'superadmin'

interface UserRow {
  id: string; email: string; full_name: string; avatar_url: string | null
  is_admin: boolean; is_superadmin: boolean; joined: string
  habitCount: number; topStreak: number; weekDone: number; weekTotal: number
  booksReading: number; booksCompleted: number; workoutsWeek: number
  activeGoals: number; openTodos: number
}

interface GlobalHabit {
  id: string; habit_name: string; category: string; frequency: string; created_at: string
}

export interface GlobalGalleryItem {
  id: string; url: string; caption: string | null; mime_type: string | null
  storage_path: string; created_at: string
}

export interface GlobalBookItem {
  id: string; book_title: string; author: string | null; genre: string | null
  status: string; has_mindmap: boolean; created_at: string
}

const CATEGORY_COLOR: Record<string, string> = Object.fromEntries(
  Object.entries(HABIT_CATEGORY_META).map(([key, meta]) => [key, meta.badge])
)

export default function AdminDashboard({
  users: initialUsers,
  globalHabits: initialGlobalHabits,
  globalGallery: initialGlobalGallery,
  globalBooks: initialGlobalBooks,
  meId,
  isSuperadmin,
}: {
  users: UserRow[]
  globalHabits: GlobalHabit[]
  globalGallery: GlobalGalleryItem[]
  globalBooks: GlobalBookItem[]
  meId: string
  isSuperadmin: boolean
}) {
  const [tab, setTab]                 = useState<'users' | 'global' | 'gallery' | 'books'>('users')
  const [search, setSearch]           = useState('')
  const [users, setUsers]             = useState(initialUsers)
  const [globalHabits, setGlobalHabits] = useState(initialGlobalHabits)
  const [globalGallery, setGlobalGallery] = useState(initialGlobalGallery)
  const [globalBooks, setGlobalBooks]     = useState(initialGlobalBooks)
  const [removingBookId, setRemovingBookId] = useState<string | null>(null)
  const [togglingId, setTogglingId]   = useState<string | null>(null)
  const [deletingId, setDeletingId]   = useState<string | null>(null)
  const [removingGalleryId, setRemovingGalleryId] = useState<string | null>(null)
  const [addingHabit, setAddingHabit] = useState(false)
  const [newHabit, setNewHabit]       = useState({ habit_name: '', category: 'health', frequency: 'daily' })
  const [editingHabit, setEditingHabit] = useState<GlobalHabit | null>(null)
  const [savingEdit, setSavingEdit]     = useState(false)

  const [msgTarget, setMsgTarget] = useState<{ id: string; name: string } | 'broadcast' | null>(null)
  const [msgTitle, setMsgTitle]   = useState('')
  const [msgBody, setMsgBody]     = useState('')
  const [msgSending, setMsgSending] = useState(false)
  const [msgSent, setMsgSent]     = useState(false)

  const filtered = users.filter(u =>
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  function currentRole(u: UserRow): Role {
    if (u.is_superadmin) return 'superadmin'
    if (u.is_admin)      return 'admin'
    return 'user'
  }

  async function setRole(u: UserRow, role: Role) {
    setTogglingId(u.id)
    const res = await fetch('/api/admin/set-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: u.id, role }),
    })
    if (res.ok) setUsers(prev => prev.map(x => x.id === u.id
      ? { ...x, is_admin: role === 'admin' || role === 'superadmin', is_superadmin: role === 'superadmin' }
      : x
    ))
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
    setNewHabit({ habit_name: '', category: 'health', frequency: 'daily' })
    setAddingHabit(false)
  }

  async function saveGlobalHabitEdit(habit: GlobalHabit) {
    setSavingEdit(true)
    const res = await fetch(`/api/admin/global-habits?id=${habit.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ habit_name: habit.habit_name, category: habit.category, frequency: habit.frequency }),
    })
    const data = await res.json()
    if (data.habit) setGlobalHabits(prev => prev.map(h => h.id === habit.id ? data.habit : h))
    setSavingEdit(false)
    setEditingHabit(null)
  }

  async function removeFromGlobalBooks(id: string) {
    setRemovingBookId(id)
    await fetch(`/api/admin/global-books?id=${id}&global=false`, { method: 'PATCH' })
    setGlobalBooks(prev => prev.filter(b => b.id !== id))
    setRemovingBookId(null)
  }

  async function removeFromGlobalGallery(id: string) {
    setRemovingGalleryId(id)
    await fetch(`/api/admin/global-gallery?id=${id}&global=false`, { method: 'PATCH' })
    setGlobalGallery(prev => prev.filter(i => i.id !== id))
    setRemovingGalleryId(null)
  }

  async function sendMessage() {
    if (!msgTitle.trim() || !msgBody.trim() || !msgTarget) return
    setMsgSending(true)
    await fetch('/api/admin/send-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: msgTitle,
        body: msgBody,
        user_id: msgTarget === 'broadcast' ? null : msgTarget.id,
      }),
    })
    setMsgSending(false)
    setMsgSent(true)
    setTimeout(() => { setMsgTarget(null); setMsgTitle(''); setMsgBody(''); setMsgSent(false) }, 1500)
  }

  function galleryKind(item: GlobalGalleryItem) {
    if (item.mime_type) {
      if (item.mime_type.startsWith('image/'))  return 'image'
      if (item.mime_type.startsWith('video/'))  return 'video'
      if (item.mime_type.startsWith('audio/'))  return 'audio'
      if (item.mime_type === 'application/pdf') return 'pdf'
    }
    const p = item.storage_path.toLowerCase()
    if (/\.(mp4|webm|mov)$/.test(p))  return 'video'
    if (/\.(mp3|wav|ogg|aac)$/.test(p)) return 'audio'
    if (p.endsWith('.pdf'))             return 'pdf'
    return 'image'
  }

  const totalUsers   = users.length
  const adminCount   = users.filter(u => u.is_admin).length
  const totalGlobal  = globalHabits.length
  const activeThisWk = users.filter(u => u.weekDone > 0).length

  return (
    <div className="min-h-screen p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage users, monitor progress, and set global content</p>
        </div>
        <button
          onClick={() => setMsgTarget('broadcast')}
          className="flex items-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-300 hover:bg-violet-500/20 transition-colors"
        >
          <MessageSquare className="h-4 w-4" />
          Broadcast
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Users',      value: totalUsers,            icon: Users,  color: 'text-indigo-400' },
          { label: 'Admins',           value: adminCount,            icon: Shield, color: 'text-violet-400' },
          { label: 'Active This Week', value: activeThisWk,          icon: Flame,  color: 'text-orange-400' },
          { label: 'Global Habits',    value: totalGlobal,           icon: Globe,     color: 'text-emerald-400' },
          { label: 'Global Gallery',   value: globalGallery.length,  icon: Image,     color: 'text-sky-400'     },
          { label: 'Global Books',     value: globalBooks.length,    icon: BookOpen,  color: 'text-amber-400'   },
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
      <div className="flex gap-1 border-b border-white/[0.06] overflow-x-auto pb-0 scrollbar-none">
        {([
          { key: 'users',   label: `Users (${totalUsers})` },
          { key: 'global',  label: `Global Habits (${totalGlobal})` },
          { key: 'gallery', label: `Global Gallery (${globalGallery.length})` },
          { key: 'books',   label: `Global Books (${globalBooks.length})` },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'shrink-0 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap',
              tab === key
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-500 hover:text-slate-300',
            )}
          >
            {label}
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

          {/* Desktop Table */}
          <div className="hidden md:block rounded-xl border border-white/[0.06] overflow-x-auto">
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
                              {u.is_superadmin && <ShieldCheck className="h-3 w-3 text-amber-400 shrink-0" />}
                              {u.is_admin && !u.is_superadmin && <Shield className="h-3 w-3 text-violet-400 shrink-0" />}
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
                          {/* Role selector — hidden for self */}
                          {u.id !== meId && (
                            togglingId === u.id
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" />
                              : (
                                <select
                                  value={currentRole(u)}
                                  onChange={e => setRole(u, e.target.value as Role)}
                                  disabled={!isSuperadmin && currentRole(u) === 'superadmin'}
                                  className="text-xs rounded-md bg-white/[0.04] border border-white/[0.10] text-slate-300 px-2 py-1 focus:outline-none focus:border-indigo-500/50 disabled:opacity-40"
                                >
                                  <option value="user">User</option>
                                  <option value="admin">Admin</option>
                                  {isSuperadmin && <option value="superadmin">Superadmin</option>}
                                </select>
                              )
                          )}
                          <button
                            onClick={() => { setMsgTarget({ id: u.id, name: u.full_name || u.email }); setMsgTitle(''); setMsgBody('') }}
                            title="Send message"
                            className="flex items-center justify-center w-7 h-7 rounded-md border border-white/10 text-slate-500 hover:text-violet-300 hover:border-violet-500/30 transition-colors"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                          </button>
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

          {/* Mobile card list */}
          <div className="md:hidden space-y-3">
            {filtered.map(u => {
              const initials = u.full_name.split(' ').map((n: string) => n[0]).join('').slice(0,2).toUpperCase() || u.email[0].toUpperCase()
              const pct = u.weekTotal > 0 ? Math.round((u.weekDone / u.weekTotal) * 100) : null
              return (
                <div key={u.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
                  {/* User row */}
                  <div className="flex items-center gap-3">
                    {u.avatar_url
                      ? <img src={u.avatar_url} alt={u.full_name} className="h-10 w-10 rounded-full object-cover ring-1 ring-white/10 shrink-0" />
                      : <div className="h-10 w-10 rounded-full bg-indigo-500/20 ring-1 ring-indigo-500/30 flex items-center justify-center text-xs font-semibold text-indigo-300 shrink-0">{initials}</div>
                    }
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-white truncate">{u.full_name || '—'}</span>
                        {u.is_superadmin && <ShieldCheck className="h-3 w-3 text-amber-400 shrink-0" />}
                        {u.is_admin && !u.is_superadmin && <Shield className="h-3 w-3 text-violet-400 shrink-0" />}
                      </div>
                      <span className="text-xs text-slate-500 truncate block">{u.email}</span>
                    </div>
                  </div>
                  {/* Stats chips */}
                  <div className="flex flex-wrap gap-2 text-xs">
                    {pct !== null && (
                      <span className={cn('rounded-full px-2.5 py-1 font-medium', pct >= 70 ? 'bg-emerald-500/15 text-emerald-400' : pct >= 40 ? 'bg-amber-500/15 text-amber-400' : 'bg-red-500/15 text-red-400')}>
                        {pct}% this week
                      </span>
                    )}
                    {u.topStreak > 0 && (
                      <span className="rounded-full px-2.5 py-1 bg-orange-500/10 text-orange-400 flex items-center gap-1">
                        <Flame className="h-3 w-3" />{u.topStreak}d
                      </span>
                    )}
                    {u.habitCount > 0 && <span className="rounded-full px-2.5 py-1 bg-white/5 text-slate-400">{u.habitCount} habits</span>}
                    {u.booksReading > 0 && <span className="rounded-full px-2.5 py-1 bg-white/5 text-slate-400">{u.booksReading} reading</span>}
                    {u.workoutsWeek > 0 && <span className="rounded-full px-2.5 py-1 bg-white/5 text-slate-400">{u.workoutsWeek} workouts</span>}
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1">
                    {u.id !== meId && (
                      togglingId === u.id
                        ? <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                        : (
                          <select
                            value={currentRole(u)}
                            onChange={e => setRole(u, e.target.value as Role)}
                            disabled={!isSuperadmin && currentRole(u) === 'superadmin'}
                            className="flex-1 text-xs rounded-lg bg-white/[0.04] border border-white/[0.10] text-slate-300 px-3 py-2 focus:outline-none focus:border-indigo-500/50 disabled:opacity-40"
                          >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                            {isSuperadmin && <option value="superadmin">Superadmin</option>}
                          </select>
                        )
                    )}
                    <button
                      onClick={() => { setMsgTarget({ id: u.id, name: u.full_name || u.email }); setMsgTitle(''); setMsgBody('') }}
                      className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-slate-400 hover:text-white hover:border-white/20 transition-colors"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      Message
                    </button>
                    <Link
                      href={`/admin/users/${u.id}`}
                      className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-slate-400 hover:text-white hover:border-white/20 transition-colors"
                    >
                      View <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              )
            })}
            {filtered.length === 0 && (
              <p className="text-center text-slate-500 text-sm py-8">No users found</p>
            )}
          </div>
        </div>
      )}

      {/* Global Gallery tab */}
      {tab === 'gallery' && (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <p className="text-sm text-slate-400">
              Files marked global appear in every user&apos;s gallery as read-only. Upload files from your{' '}
              <a href="/gallery" className="text-sky-400 hover:text-sky-300 underline underline-offset-2">Gallery page</a>
              {' '}and open them in the lightbox to toggle global status.
            </p>
          </div>

          {globalGallery.length === 0 ? (
            <div className="rounded-xl border border-white/[0.06] p-12 text-center">
              <Globe className="h-10 w-10 text-slate-700 mx-auto mb-3" />
              <p className="text-sm text-slate-500">No global gallery files yet.</p>
              <p className="text-xs text-slate-600 mt-1">
                Go to your Gallery, open any file, and click &ldquo;Make global&rdquo;.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {globalGallery.map(item => {
                const kind = galleryKind(item)
                return (
                  <div
                    key={item.id}
                    className="group relative rounded-xl overflow-hidden border border-sky-500/30 bg-white/5"
                  >
                    {/* Thumbnail */}
                    {kind === 'image' ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={item.url}
                        alt={item.caption ?? ''}
                        className="w-full h-32 object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-32 gap-2">
                        {kind === 'video'  && <Video    className="h-8 w-8 text-slate-500" />}
                        {kind === 'audio'  && <Music    className="h-8 w-8 text-violet-400" />}
                        {kind === 'pdf'    && <FileText className="h-8 w-8 text-red-400" />}
                        <p className="text-[10px] text-slate-500 text-center px-2 line-clamp-2">
                          {item.caption ?? item.storage_path.split('/').pop()}
                        </p>
                      </div>
                    )}

                    {/* Global badge */}
                    <div className="absolute top-1.5 left-1.5 flex items-center gap-0.5 rounded-full bg-sky-500/20 border border-sky-500/40 px-1.5 py-0.5">
                      <Globe className="h-2.5 w-2.5 text-sky-400" />
                      <span className="text-[9px] font-medium text-sky-400">Global</span>
                    </div>

                    {/* Remove button */}
                    <button
                      onClick={() => removeFromGlobalGallery(item.id)}
                      disabled={removingGalleryId === item.id}
                      title="Remove from global gallery"
                      className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-slate-400 opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-black/80 transition-all"
                    >
                      {removingGalleryId === item.id
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <X className="h-3 w-3" />}
                    </button>

                    {/* Caption footer */}
                    {item.caption && (
                      <div className="px-2 py-1.5 border-t border-white/5">
                        <p className="text-[10px] text-slate-400 line-clamp-1">{item.caption}</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Global Books tab */}
      {tab === 'books' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Books marked global appear in every user&apos;s reading list. They can view the mind map, summary, quotes, and stories — but cannot edit or delete them.
            Mark books global from your{' '}
            <a href="/books" className="text-amber-400 hover:text-amber-300 underline underline-offset-2">Books page</a>
            {' '}using the 🌐 globe icon on hover.
          </p>

          {globalBooks.length === 0 ? (
            <div className="rounded-xl border border-white/[0.06] p-12 text-center">
              <BookOpen className="h-10 w-10 text-slate-700 mx-auto mb-3" />
              <p className="text-sm text-slate-500">No global books yet.</p>
              <p className="text-xs text-slate-600 mt-1">
                Go to your Books page, hover a book, and click the 🌐 icon.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {globalBooks.map(book => (
                <div key={book.id} className="group flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                  <div className="h-9 w-7 rounded bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center shrink-0">
                    <BookOpen className="h-3.5 w-3.5 text-white/70" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white truncate">{book.book_title}</p>
                      {book.has_mindmap && (
                        <span className="text-[10px] text-cyan-400 border border-cyan-500/30 rounded px-1.5 py-0.5 shrink-0">map</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate">
                      {book.author ?? 'Unknown author'}
                      {book.genre ? ` · ${book.genre}` : ''}
                      {' · '}<span className="capitalize">{book.status.replace('_', ' ')}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => removeFromGlobalBooks(book.id)}
                    disabled={removingBookId === book.id}
                    title="Remove from global"
                    className="flex items-center justify-center w-7 h-7 rounded-md border border-white/10 text-slate-500 opacity-0 group-hover:opacity-100 hover:text-red-400 hover:border-red-500/30 transition-all"
                  >
                    {removingBookId === book.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          )}
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
                {HABIT_CATEGORIES.map(c => (
                  <option key={c} value={c}>{HABIT_CATEGORY_META[c].label}</option>
                ))}
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
                    onClick={() => setEditingHabit(h)}
                    className="flex items-center justify-center w-7 h-7 rounded-md border border-white/10 text-slate-500 hover:text-indigo-400 hover:border-indigo-500/30 transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
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

      {/* Message compose modal */}
      {msgTarget && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0d0d1a] shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-white">Send Message</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {msgTarget === 'broadcast' ? 'To: All users (broadcast)' : `To: ${(msgTarget as any).name}`}
                </p>
              </div>
              <button onClick={() => { setMsgTarget(null); setMsgTitle(''); setMsgBody('') }} className="text-slate-500 hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {msgSent ? (
              <div className="flex flex-col items-center gap-2 py-6">
                <div className="h-12 w-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Send className="h-5 w-5 text-emerald-400" />
                </div>
                <p className="text-sm font-medium text-white">Message sent!</p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-slate-400 block mb-1.5">Title</label>
                    <input
                      value={msgTitle}
                      onChange={e => setMsgTitle(e.target.value)}
                      placeholder="e.g. Platform Update"
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-400 block mb-1.5">Message</label>
                    <textarea
                      value={msgBody}
                      onChange={e => setMsgBody(e.target.value)}
                      placeholder="Write your message…"
                      rows={4}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 resize-none"
                    />
                  </div>
                </div>
                <button
                  onClick={sendMessage}
                  disabled={msgSending || !msgTitle.trim() || !msgBody.trim()}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-3 text-sm font-medium text-white transition-colors"
                >
                  {msgSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {msgSending ? 'Sending…' : 'Send Message'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Edit global habit modal */}
      {editingHabit && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0d0d1a] shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Edit Global Habit</h3>
              <button onClick={() => setEditingHabit(null)} className="text-slate-500 hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1.5">Habit name</label>
                <input
                  autoFocus
                  value={editingHabit.habit_name}
                  onChange={e => setEditingHabit(h => h ? { ...h, habit_name: e.target.value } : h)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1.5">Category</label>
                <select
                  value={editingHabit.category}
                  onChange={e => setEditingHabit(h => h ? { ...h, category: e.target.value } : h)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                >
                  {HABIT_CATEGORIES.map(c => (
                    <option key={c} value={c}>{HABIT_CATEGORY_META[c].label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1.5">Frequency</label>
                <select
                  value={editingHabit.frequency}
                  onChange={e => setEditingHabit(h => h ? { ...h, frequency: e.target.value } : h)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
            </div>
            <button
              onClick={() => saveGlobalHabitEdit(editingHabit)}
              disabled={savingEdit || !editingHabit.habit_name.trim()}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-3 text-sm font-medium text-white transition-colors"
            >
              {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
              {savingEdit ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
