'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import {
  Users, Globe, Flame, BookOpen, Dumbbell, Target,
  CheckSquare, Plus, Trash2, Loader2, Shield, ShieldOff,
  ChevronRight, Search, ShieldCheck, Image, FileText, Music, Video, X,
  Send, MessageSquare, Pencil, AlertCircle, Activity, UserPlus, Moon } from 'lucide-react'
import { HABIT_CATEGORIES, HABIT_CATEGORY_META } from '@/lib/habitCategories'
import { cn } from '@/lib/utils'
import { activityStatus, timeAgo, type ActivityStatus } from '@/lib/admin/activity'
import PageHeader from '@/components/ui/page-header'
import SegmentedTabs from '@/components/ui/segmented-tabs'
import StatTile from '@/components/ui/stat-tile'

// Status dot + wording for how recently a user did anything.
const STATUS_META: Record<ActivityStatus, { dot: string; text: string; label: string }> = {
  today:   { dot: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]', text: 'text-emerald-300', label: 'Active today' },
  week:    { dot: 'bg-sky-400',     text: 'text-sky-300',     label: 'Active this week' },
  month:   { dot: 'bg-amber-400',   text: 'text-amber-300',   label: 'Idle' },
  dormant: { dot: 'bg-slate-500',   text: 'text-slate-400',   label: 'Dormant' },
  never:   { dot: 'bg-slate-700',   text: 'text-slate-500',   label: 'No activity yet' },
}

type UserFilter = 'all' | 'today' | 'week' | 'dormant' | 'admins'
type UserSort = 'active' | 'newest' | 'name' | 'streak'

type Role = 'user' | 'admin' | 'superadmin'

interface UserRow {
  id: string; email: string; full_name: string; avatar_url: string | null
  is_admin: boolean; is_superadmin: boolean; joined: string
  habitCount: number; topStreak: number; weekDone: number; weekTotal: number
  booksReading: number; booksCompleted: number; workoutsWeek: number
  activeGoals: number; openTodos: number
  lastActiveAt: string | null; lastActiveLabel: string | null; lastSignIn: string | null
  provider: string; points: number; perfectStreak: number
  country: string | null; occupation: string | null
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
  const [editError, setEditError]       = useState<string | null>(null)

  const [msgTarget, setMsgTarget] = useState<{ id: string; name: string } | 'broadcast' | null>(null)
  const [msgTitle, setMsgTitle]   = useState('')
  const [msgBody, setMsgBody]     = useState('')
  const [msgSending, setMsgSending] = useState(false)
  const [msgSent, setMsgSent]     = useState(false)

  // Delete-user confirmation: the admin types the user's email to confirm.
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null)
  const [deleteEmail, setDeleteEmail]   = useState('')
  const [deleting, setDeleting]         = useState(false)
  const [deleteError, setDeleteError]   = useState<string | null>(null)
  const canDelete = (u: UserRow) => u.id !== meId && (isSuperadmin || !u.is_admin)
  async function deleteUser() {
    if (!deleteTarget) return
    setDeleting(true); setDeleteError(null)
    const res = await fetch('/api/admin/delete-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: deleteTarget.id, confirmEmail: deleteEmail }),
    })
    const data = await res.json().catch(() => ({}))
    setDeleting(false)
    if (!res.ok) { setDeleteError(data.error ?? 'Could not delete this user'); return }
    setUsers(prev => prev.filter(x => x.id !== deleteTarget.id))
    setDeleteTarget(null); setDeleteEmail('')
  }

  const [filter, setFilter] = useState<UserFilter>('all')
  const [sort, setSort]     = useState<UserSort>('active')
  const statusOf = (u: UserRow) => activityStatus(u.lastActiveAt)
  const q = search.trim().toLowerCase()
  const filtered = users
    .filter(u => !q || u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    .filter(u =>
      filter === 'all'     ? true
      : filter === 'today' ? statusOf(u) === 'today'
      : filter === 'week'  ? ['today', 'week'].includes(statusOf(u))
      : filter === 'dormant' ? ['dormant', 'never'].includes(statusOf(u))
      : u.is_admin)
    .sort((a, b) =>
      sort === 'active' ? (b.lastActiveAt ?? '').localeCompare(a.lastActiveAt ?? '')
      : sort === 'newest' ? b.joined.localeCompare(a.joined)
      : sort === 'name'   ? (a.full_name || a.email).localeCompare(b.full_name || b.email)
      : b.topStreak - a.topStreak)

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
    setEditError(null)
    const res = await fetch(`/api/admin/global-habits?id=${habit.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ habit_name: habit.habit_name, category: habit.category, frequency: habit.frequency }),
    })
    const data = await res.json()
    setSavingEdit(false)
    if (!res.ok || !data.habit) { setEditError(data.error ?? 'Failed to save changes'); return }
    setGlobalHabits(prev => prev.map(h => h.id === habit.id ? data.habit : h))
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
  const activeToday  = users.filter(u => statusOf(u) === 'today').length
  const activeThisWk = users.filter(u => ['today', 'week'].includes(statusOf(u))).length
  const newThisWk    = users.filter(u => Date.now() - new Date(u.joined).getTime() < 7 * 86_400_000).length
  const dormantCount = users.filter(u => ['dormant', 'never'].includes(statusOf(u))).length

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 md:px-8">
      <PageHeader
        icon={ShieldCheck}
        tone="indigo"
        title="Admin"
        subtitle="People, activity and shared content"
        className="mb-0"
        right={
          <button
            onClick={() => setMsgTarget('broadcast')}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 px-3.5 py-2 text-sm font-medium text-snow shadow-[0_6px_20px_-8px_rgba(99,102,241,0.7)] transition active:scale-95"
          >
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Broadcast</span>
          </button>
        }
      />

      {/* People at a glance */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile icon={Users} tone="violet" label="Users" value={totalUsers} sub={`${adminCount} admin${adminCount === 1 ? '' : 's'}`} />
        <StatTile icon={Activity} tone="emerald" label="Active today" value={activeToday} sub={`${activeThisWk} this week`} />
        <StatTile icon={UserPlus} tone="sky" label="New this week" value={newThisWk} />
        <StatTile icon={Moon} tone="amber" label="Dormant 30d+" value={dormantCount} />
      </div>

      <SegmentedTabs
        className="mb-0"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'users',   label: 'Users',   icon: Users,    badge: totalUsers },
          { value: 'global',  label: 'Habits',  icon: Globe,    badge: totalGlobal },
          { value: 'gallery', label: 'Gallery', icon: Image,    badge: globalGallery.length },
          { value: 'books',   label: 'Books',   icon: BookOpen, badge: globalBooks.length },
        ]}
      />

      {deleteTarget && (
        <div className="sheet-in fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center" onClick={e => { if (e.target === e.currentTarget && !deleting) setDeleteTarget(null) }}>
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-red-500/30 bg-slate-900 p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/15">
                <AlertCircle className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <p className="text-base font-semibold text-white">Delete {deleteTarget.full_name || deleteTarget.email}?</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  This permanently deletes their account and everything in it: habits, plans, goals, journal, finances,
                  fitness logs, rewards and their gallery files. It can&apos;t be undone.
                </p>
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="confirm-email" className="text-xs text-slate-400">
                Type <span className="font-semibold text-slate-200">{deleteTarget.email}</span> to confirm
              </label>
              <input
                id="confirm-email"
                autoFocus
                autoComplete="off"
                value={deleteEmail}
                onChange={e => setDeleteEmail(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
              />
            </div>
            {deleteError && <p className="text-xs text-red-400">{deleteError}</p>}
            <div className="flex gap-2">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm text-slate-300 hover:bg-white/10">
                Cancel
              </button>
              <button
                onClick={deleteUser}
                disabled={deleting || deleteEmail.trim().toLowerCase() !== deleteTarget.email.toLowerCase()}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-snow hover:bg-red-700 disabled:opacity-40"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Users tab */}
      {tab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 basis-56">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name or email…"
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2 pl-9 pr-3 text-sm text-white placeholder:text-slate-600 focus:border-indigo-500/50 focus:outline-none"
              />
            </div>
            <select
              value={sort}
              onChange={e => setSort(e.target.value as UserSort)}
              aria-label="Sort users"
              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-300 focus:outline-none"
            >
              <option value="active">Last active</option>
              <option value="newest">Newest</option>
              <option value="name">Name</option>
              <option value="streak">Top streak</option>
            </select>
          </div>

          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {([
              ['all', 'All', totalUsers],
              ['today', 'Active today', activeToday],
              ['week', 'This week', activeThisWk],
              ['dormant', 'Dormant', dormantCount],
              ['admins', 'Admins', adminCount],
            ] as const).map(([value, label, count]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all active:scale-95',
                  filter === value ? 'border-indigo-400/50 bg-indigo-500/20 text-white' : 'border-white/10 bg-white/[0.03] text-slate-400 hover:text-white',
                )}
              >
                {label}
                <span className={cn('rounded-full px-1.5 text-[10px] font-bold leading-4', filter === value ? 'bg-white/20' : 'bg-white/10')}>{count}</span>
              </button>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map(u => {
              const initials = u.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || u.email[0].toUpperCase()
              const pct = u.weekTotal > 0 ? Math.round((u.weekDone / u.weekTotal) * 100) : null
              const st = STATUS_META[statusOf(u)]
              return (
                <div key={u.id} className="card-sheen flex flex-col gap-3 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.01] p-4">
                  {/* Who + when */}
                  <Link href={`/admin/users/${u.id}`} className="group flex items-center gap-3">
                    <div className="relative shrink-0">
                      {u.avatar_url
                        ? <img src={u.avatar_url} alt={u.full_name} className="h-11 w-11 rounded-full object-cover ring-1 ring-white/10" />
                        : <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/40 to-violet-600/40 text-xs font-semibold text-indigo-100 ring-1 ring-indigo-400/30">{initials}</div>}
                      <span className={cn('absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-slate-900', st.dot)} title={st.label} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-semibold text-white group-hover:text-indigo-200">{u.full_name || '—'}</span>
                        {u.is_superadmin && <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-amber-400" />}
                        {u.is_admin && !u.is_superadmin && <Shield className="h-3.5 w-3.5 shrink-0 text-violet-400" />}
                      </div>
                      <span className="block truncate text-xs text-slate-500">{u.email}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-600 transition-transform group-hover:translate-x-0.5 group-hover:text-white" />
                  </Link>

                  <div className="rounded-xl bg-white/[0.04] px-3 py-2">
                    <p className={cn('text-xs font-semibold', st.text)}>
                      {u.lastActiveAt ? `Active ${timeAgo(u.lastActiveAt)}` : st.label}
                    </p>
                    {u.lastActiveLabel && <p className="truncate text-[11px] text-slate-400">{u.lastActiveLabel}</p>}
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      Joined {timeAgo(u.joined)}
                      {u.lastSignIn && <> · signed in {timeAgo(u.lastSignIn)}</>}
                      {u.provider !== 'email' && <> · via {u.provider}</>}
                      {u.country && <> · {u.country}</>}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    {pct !== null && (
                      <span className={cn('rounded-full px-2 py-0.5 font-semibold', pct >= 70 ? 'bg-emerald-500/15 text-emerald-300' : pct >= 40 ? 'bg-amber-500/15 text-amber-300' : 'bg-red-500/15 text-red-300')}>
                        {pct}% habits this week
                      </span>
                    )}
                    {u.topStreak > 0 && <span className="flex items-center gap-1 rounded-full bg-orange-500/15 px-2 py-0.5 font-semibold text-orange-300"><Flame className="h-3 w-3" />{u.topStreak}d</span>}
                    {u.points > 0 && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-semibold text-amber-300">{u.points.toLocaleString()} pts</span>}
                    {u.habitCount > 0 && <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-slate-300">{u.habitCount} habits</span>}
                    {u.activeGoals > 0 && <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-slate-300">{u.activeGoals} goals</span>}
                    {u.workoutsWeek > 0 && <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-slate-300">{u.workoutsWeek} workouts</span>}
                    {(u.booksReading > 0 || u.booksCompleted > 0) && <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-slate-300">{u.booksReading} reading · {u.booksCompleted} read</span>}
                    {u.openTodos > 0 && <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-slate-300">{u.openTodos} open plans</span>}
                  </div>

                  <div className="mt-auto flex items-center gap-2 border-t border-white/[0.06] pt-3">
                    {u.id !== meId ? (
                      togglingId === u.id
                        ? <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                        : (
                          <select
                            value={currentRole(u)}
                            onChange={e => setRole(u, e.target.value as Role)}
                            disabled={!isSuperadmin && currentRole(u) === 'superadmin'}
                            aria-label="Role"
                            className="flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none disabled:opacity-40"
                          >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                            {isSuperadmin && <option value="superadmin">Superadmin</option>}
                          </select>
                        )
                    ) : <span className="flex-1 text-xs text-slate-500">This is you</span>}
                    <button
                      onClick={() => { setMsgTarget({ id: u.id, name: u.full_name || u.email }); setMsgTitle(''); setMsgBody('') }}
                      className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-slate-300 transition-colors hover:border-violet-500/30 hover:text-violet-200"
                    >
                      <MessageSquare className="h-3.5 w-3.5" /> Message
                    </button>
                    {canDelete(u) && (
                      <button
                        onClick={() => { setDeleteTarget(u); setDeleteEmail(''); setDeleteError(null) }}
                        aria-label={`Delete ${u.full_name || u.email}`}
                        title="Delete user"
                        className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-red-500/20 bg-red-500/[0.06] text-red-300/80 transition-colors hover:bg-red-500/15 hover:text-red-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-500">No users match.</p>
          )}
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
                      className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-slate-400 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 hover:text-red-400 hover:bg-black/80 transition-all"
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
                    className="flex items-center justify-center w-7 h-7 rounded-md border border-white/10 text-slate-500 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 hover:text-red-400 hover:border-red-500/30 transition-all"
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
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-snow text-sm font-medium transition-colors"
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
                    onClick={() => { setEditError(null); setEditingHabit(h) }}
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
        <div className="sheet-in fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-surface shadow-2xl p-5 space-y-4">
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
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-3 text-sm font-medium text-snow transition-colors"
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
        <div className="sheet-in fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-surface shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Edit Global Habit</h3>
              <button onClick={() => { setEditingHabit(null); setEditError(null) }} className="text-slate-500 hover:text-white transition-colors">
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
            {editError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2">
                <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-red-400">{editError}</p>
              </div>
            )}
            <button
              onClick={() => saveGlobalHabitEdit(editingHabit)}
              disabled={savingEdit || !editingHabit.habit_name.trim()}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-3 text-sm font-medium text-snow transition-colors"
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
