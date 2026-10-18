'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { activityStatus, timeAgo, type ActivityEvent, type ActivityStatus } from '@/lib/admin/activity'
import StatTile from '@/components/ui/stat-tile'
import {
  ChevronLeft, Flame, BookOpen, Dumbbell, Target, CheckSquare,
  Globe, Pencil, Trash2, Plus, Loader2, Check, X, Save,
  ShieldCheck, Shield, Coins, Trophy, CalendarCheck, Activity, AlertCircle,
} from 'lucide-react'
import { HABIT_CATEGORIES, HABIT_CATEGORY_META } from '@/lib/habitCategories'
import { cn } from '@/lib/utils'

const CATEGORY_COLOR: Record<string, string> = Object.fromEntries(
  Object.entries(HABIT_CATEGORY_META).map(([key, meta]) => [key, meta.badge])
)

type Habit   = { id: string; habit_name: string; category: string; frequency: string; streak_count: number; longest_streak: number; is_keystone: boolean; is_global: boolean }
type HabitLog = { habit_id: string; log_date: string; status: string }
type Book    = { id: string; book_title: string; author: string | null; status: string }
type Workout = { id: string; log_date: string; workout_type: string | null; duration_mins: number | null }
type Goal    = { id: string; title: string; is_completed: boolean; target_date: string | null }
type Account = {
  joined: string; lastSignIn: string | null; emailVerified: boolean; provider: string
  timezone: string | null; points: number; perfectStreak: number; bestPerfect: number
}

const STATUS_META: Record<ActivityStatus, { dot: string; text: string; label: string }> = {
  today:   { dot: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]', text: 'text-emerald-300', label: 'Active today' },
  week:    { dot: 'bg-sky-400',   text: 'text-sky-300',   label: 'Active this week' },
  month:   { dot: 'bg-amber-400', text: 'text-amber-300', label: 'Idle' },
  dormant: { dot: 'bg-slate-500', text: 'text-slate-400', label: 'Dormant' },
  never:   { dot: 'bg-slate-700', text: 'text-slate-500', label: 'No activity yet' },
}

// "7 Sept 2026 (3d ago)" — the relative part only when it adds something.
const withAgo = (iso: string) => { const rel = timeAgo(iso); return rel.endsWith('ago') || rel === 'just now' ? `${fmtDate(iso)} (${rel})` : fmtDate(iso) }
const fmtDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
type Todo    = { id: string; title: string; completed: boolean }
type Profile = Record<string, unknown>

async function apiPatch(table: string, id: string, data: Record<string, unknown>) {
  return fetch('/api/superadmin/edit', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ table, id, data }),
  })
}
async function apiPost(table: string, data: Record<string, unknown>) {
  const res = await fetch('/api/superadmin/edit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ table, data }),
  })
  return res.json()
}
async function apiDelete(table: string, id: string) {
  return fetch(`/api/superadmin/edit?table=${table}&id=${id}`, { method: 'DELETE' })
}

function InlineText({ value, onSave, className }: { value: string; onSave: (v: string) => void; className?: string }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(value)
  if (!editing) return (
    <span className={cn('cursor-pointer hover:text-white group/txt', className)} onClick={() => { setDraft(value); setEditing(true) }}>
      {value || <span className="text-slate-600 italic">—</span>}
      <Pencil className="inline h-3 w-3 ml-1.5 text-slate-600 opacity-0 group-hover/txt:opacity-100 transition-opacity" />
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1">
      <input
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { onSave(draft); setEditing(false) }
          if (e.key === 'Escape') setEditing(false)
        }}
        className="bg-slate-800 border border-white/20 rounded px-2 py-0.5 text-sm text-white focus:outline-none focus:border-indigo-500/60 min-w-0 w-40"
      />
      <button onClick={() => { onSave(draft); setEditing(false) }} className="text-emerald-400 hover:text-emerald-300"><Check className="h-3.5 w-3.5" /></button>
      <button onClick={() => setEditing(false)} className="text-slate-500 hover:text-white"><X className="h-3.5 w-3.5" /></button>
    </span>
  )
}

export default function UserDetailClient({
  userId, email, profile: initialProfile,
  habits: initialHabits, habitLogs, today,
  books: initialBooks, workouts, goals: initialGoals, todos: initialTodos,
  isSuperadmin, meId, account, activity,
}: {
  userId: string; email: string; profile: Profile
  habits: Habit[]; habitLogs: HabitLog[]; today: string
  books: Book[]; workouts: Workout[]; goals: Goal[]; todos: Todo[]
  isSuperadmin: boolean; meId: string; account: Account; activity: ActivityEvent[]
}) {
  const router = useRouter()
  const [deleteOpen, setDeleteOpen]   = useState(false)
  const [deleteEmail, setDeleteEmail] = useState('')
  const [deleting, setDeleting]       = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const targetIsAdmin = !!(initialProfile.is_admin || initialProfile.is_superadmin)
  const canDelete = userId !== meId && (isSuperadmin || !targetIsAdmin)
  async function deleteUser() {
    setDeleting(true); setDeleteError(null)
    const res = await fetch('/api/admin/delete-user', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, confirmEmail: deleteEmail }),
    })
    const data = await res.json().catch(() => ({}))
    setDeleting(false)
    if (!res.ok) { setDeleteError(data.error ?? 'Could not delete this user'); return }
    router.push('/admin')
    router.refresh()
  }
  const [editMode, setEditMode] = useState(false)
  const [profile, setProfile]   = useState(initialProfile)
  const [habits, setHabits]     = useState(initialHabits)
  const [books, setBooks]       = useState(initialBooks)
  const [goals, setGoals]       = useState(initialGoals)
  const [todos, setTodos]       = useState(initialTodos)
  const [busy, setBusy]         = useState<string | null>(null)

  // Add-row forms
  const [addingHabit, setAddingHabit] = useState(false)
  const [newHabit, setNewHabit]       = useState({ habit_name: '', category: 'health', frequency: 'daily' })
  const [addingBook, setAddingBook]   = useState(false)
  const [newBook, setNewBook]         = useState({ book_title: '', author: '', status: 'reading' })
  const [addingGoal, setAddingGoal]   = useState(false)
  const [newGoal, setNewGoal]         = useState({ title: '' })
  const [addingTodo, setAddingTodo]   = useState(false)
  const [newTodo, setNewTodo]         = useState({ title: '' })

  const fullName = (profile.full_name as string) ?? ''
  const initials = fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || email[0]?.toUpperCase() || '?'

  function getHabitStatus(habitId: string) {
    const log = habitLogs.find(l => l.habit_id === habitId && l.log_date === today)
    return log?.status ?? 'pending'
  }

  // ── Profile ───────────────────────────────────────────────────

  async function saveProfile(field: string, value: string) {
    setProfile(p => ({ ...p, [field]: value }))
    await apiPatch('user_profiles', userId, { [field]: value })
  }

  // ── Habits ────────────────────────────────────────────────────

  async function deleteHabit(id: string) {
    setBusy(id)
    await apiDelete('personality_habits', id)
    setHabits(p => p.filter(h => h.id !== id))
    setBusy(null)
  }

  async function saveHabit(id: string, data: Partial<Habit>) {
    setHabits(p => p.map(h => h.id === id ? { ...h, ...data } : h))
    await apiPatch('personality_habits', id, data as Record<string, unknown>)
  }

  async function addHabit() {
    if (!newHabit.habit_name.trim()) return
    setBusy('new-habit')
    const { row } = await apiPost('personality_habits', { ...newHabit, user_id: userId, streak_count: 0, longest_streak: 0 })
    if (row) setHabits(p => [...p, row])
    setNewHabit({ habit_name: '', category: 'health', frequency: 'daily' })
    setAddingHabit(false)
    setBusy(null)
  }

  // ── Books ─────────────────────────────────────────────────────

  async function deleteBook(id: string) {
    setBusy(id)
    await apiDelete('reading_log', id)
    setBooks(p => p.filter(b => b.id !== id))
    setBusy(null)
  }

  async function saveBook(id: string, data: Partial<Book>) {
    setBooks(p => p.map(b => b.id === id ? { ...b, ...data } : b))
    await apiPatch('reading_log', id, data as Record<string, unknown>)
  }

  async function addBook() {
    if (!newBook.book_title.trim()) return
    setBusy('new-book')
    const { row } = await apiPost('reading_log', { ...newBook, user_id: userId })
    if (row) setBooks(p => [row, ...p])
    setNewBook({ book_title: '', author: '', status: 'reading' })
    setAddingBook(false)
    setBusy(null)
  }

  // ── Goals ─────────────────────────────────────────────────────

  async function deleteGoal(id: string) {
    setBusy(id)
    await apiDelete('user_goals', id)
    setGoals(p => p.filter(g => g.id !== id))
    setBusy(null)
  }

  async function saveGoal(id: string, data: Partial<Goal>) {
    setGoals(p => p.map(g => g.id === id ? { ...g, ...data } : g))
    await apiPatch('user_goals', id, data as Record<string, unknown>)
  }

  async function addGoal() {
    if (!newGoal.title.trim()) return
    setBusy('new-goal')
    const { row } = await apiPost('user_goals', { ...newGoal, user_id: userId })
    if (row) setGoals(p => [row, ...p])
    setNewGoal({ title: '' })
    setAddingGoal(false)
    setBusy(null)
  }

  // ── Todos ─────────────────────────────────────────────────────

  async function deleteTodo(id: string) {
    setBusy(id)
    await apiDelete('planner_items', id)
    setTodos(p => p.filter(t => t.id !== id))
    setBusy(null)
  }

  async function toggleTodo(todo: Todo) {
    const next = !todo.completed
    setTodos(p => p.map(t => t.id === todo.id ? { ...t, completed: next } : t))
    await apiPatch('planner_items', todo.id, { is_completed: next, completed_at: next ? new Date().toISOString() : null })
  }

  async function addTodo() {
    if (!newTodo.title.trim()) return
    setBusy('new-todo')
    const { row } = await apiPost('planner_items', {
      title: newTodo.title.trim(), user_id: userId,
      period_type: 'day', period_start: new Date().toISOString().slice(0, 10),
    })
    if (row) setTodos(p => [{ id: row.id, title: row.title, completed: row.is_completed }, ...p])
    setNewTodo({ title: '' })
    setAddingTodo(false)
    setBusy(null)
  }

  // ── Render ────────────────────────────────────────────────────

  const activeGoals    = goals.filter(g => !g.is_completed)
  const completedGoals = goals.filter(g => g.is_completed)
  const booksReading   = books.filter(b => b.status === 'reading')
  const booksCompleted = books.filter(b => b.status === 'completed')

  const topStreak      = habits.reduce((m, h) => Math.max(m, h.streak_count ?? 0), 0)
  const bestEver       = habits.reduce((m, h) => Math.max(m, h.longest_streak ?? 0), 0)
  const weekDone       = habitLogs.filter(l => l.status === 'done').length
  const weekTotal      = habitLogs.length
  const weekPct        = weekTotal > 0 ? Math.round((weekDone / weekTotal) * 100) : null

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 md:px-8">
      {/* Back + actions */}
      <div className="flex items-center gap-2">
        <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-slate-400 transition-colors hover:text-white">
          <ChevronLeft className="h-4 w-4" /> Admin
        </Link>
        <div className="ml-auto flex items-center gap-2">
          {isSuperadmin && (
            <button
              onClick={() => setEditMode(e => !e)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                editMode ? 'border-indigo-500 bg-indigo-600 text-snow hover:bg-indigo-500' : 'border-white/10 text-slate-300 hover:border-white/20 hover:text-white',
              )}
            >
              {editMode ? <><Save className="h-3.5 w-3.5" /> Editing</> : <><Pencil className="h-3.5 w-3.5" /> Edit</>}
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => { setDeleteOpen(true); setDeleteEmail(''); setDeleteError(null) }}
              className="flex items-center gap-1.5 rounded-lg border border-red-500/25 bg-red-500/[0.06] px-3 py-1.5 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/15"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          )}
        </div>
      </div>

      {/* Profile */}
      {(() => {
        const last = activity[0]?.at ?? null
        const st = STATUS_META[activityStatus(last)]
        return (
          <div className="card-sheen relative overflow-hidden rounded-2xl border border-indigo-500/25 bg-gradient-to-br from-indigo-500/15 via-violet-500/5 to-transparent p-5">
            <div aria-hidden className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-indigo-500/25 blur-3xl" />
            <div className="relative flex items-center gap-4">
              <div className="relative shrink-0">
                {profile.avatar_url
                  ? <img src={profile.avatar_url as string} alt={fullName} className="h-16 w-16 rounded-full object-cover ring-2 ring-white/10" />
                  : <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/50 to-violet-600/50 text-xl font-bold text-indigo-50 ring-2 ring-indigo-400/30">{initials}</div>}
                <span className={cn('absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-slate-900', st.dot)} title={st.label} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-xl font-bold text-white">
                    {editMode ? <InlineText value={fullName} onSave={v => saveProfile('full_name', v)} className="text-white" /> : fullName || '—'}
                  </p>
                  {profile.is_superadmin
                    ? <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300"><ShieldCheck className="h-3 w-3" /> Superadmin</span>
                    : profile.is_admin
                      ? <span className="flex items-center gap-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-[11px] font-semibold text-violet-300"><Shield className="h-3 w-3" /> Admin</span>
                      : null}
                </div>
                <p className="truncate text-sm text-slate-400">{email}</p>
                <p className={cn('mt-1 text-xs font-semibold', st.text)}>
                  {last ? `Active ${timeAgo(last)}` : st.label}
                  {activity[0] && <span className="font-normal text-slate-400"> · {activity[0].label}</span>}
                </p>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Headline numbers */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile icon={Coins} tone="amber" label="Points" value={account.points.toLocaleString()} />
        <StatTile icon={Trophy} tone="orange" label="Perfect-day streak" value={account.perfectStreak} sub={`best ${account.bestPerfect}`} />
        <StatTile icon={Flame} tone="rose" label="Top habit streak" value={topStreak} sub={`${habits.length} habit${habits.length === 1 ? '' : 's'} · best ${bestEver}`} />
        <StatTile icon={CalendarCheck} tone="emerald" label="Habits this week" value={weekPct === null ? '—' : `${weekPct}%`} sub={`${weekDone}/${weekTotal} logged`} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Account & profile details */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Details</p>
          <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 text-sm">
            {([
              ['Joined', withAgo(account.joined)],
              ['Last sign-in', account.lastSignIn ? withAgo(account.lastSignIn) : 'Never'],
              ['Signs in with', account.provider === 'email' ? 'Email & password' : account.provider[0].toUpperCase() + account.provider.slice(1)],
              ['Email verified', account.emailVerified ? 'Yes' : 'No'],
              ['Timezone', account.timezone ?? '—'],
              ['Age', profile.age ? String(profile.age) : '—'],
              ['Gender', (profile.gender as string) || '—'],
              ['Occupation', editMode ? <InlineText key="occ" value={(profile.occupation as string) ?? ''} onSave={v => saveProfile('occupation', v)} className="text-slate-200" /> : ((profile.occupation as string) || '—')],
              ['Country', editMode ? <InlineText key="cty" value={(profile.country as string) ?? ''} onSave={v => saveProfile('country', v)} className="text-slate-200" /> : ((profile.country as string) || '—')],
              ['Currency', (profile.currency as string) || '—'],
              ['Onboarding', profile.onboarding_done ? 'Completed' : 'Not finished'],
            ] as [string, React.ReactNode][]).map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-slate-500">{k}</dt>
                <dd className="min-w-0 truncate text-slate-200">{v}</dd>
              </div>
            ))}
          </dl>
          {Array.isArray(profile.primary_goals) && (profile.primary_goals as string[]).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="mr-1 text-xs text-slate-500">Focus areas:</span>
              {(profile.primary_goals as string[]).map(g => (
                <span key={g} className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-[11px] font-medium capitalize text-indigo-200">{g}</span>
              ))}
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <Activity className="h-3.5 w-3.5" /> Recent activity
          </p>
          {activity.length === 0 ? (
            <p className="text-sm text-slate-500">Nothing in the last 90 days.</p>
          ) : (
            <ol className="relative space-y-3 border-l border-white/10 pl-4">
              {activity.map((e, i) => (
                <li key={i} className="relative">
                  <span className={cn('absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-slate-900', i === 0 ? 'bg-indigo-400' : 'bg-slate-600')} />
                  <p className="truncate text-sm text-slate-200">{e.label}</p>
                  <p className="text-[11px] text-slate-500">{timeAgo(e.at)} · {new Date(e.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {deleteOpen && (
        <div className="sheet-in fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center" onClick={e => { if (e.target === e.currentTarget && !deleting) setDeleteOpen(false) }}>
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-red-500/30 bg-slate-900 p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/15"><AlertCircle className="h-5 w-5 text-red-400" /></div>
              <div>
                <p className="text-base font-semibold text-white">Delete {fullName || email}?</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  This permanently deletes their account and everything in it: habits, plans, goals, journal, finances,
                  fitness logs, rewards and their gallery files. It can&apos;t be undone.
                </p>
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="confirm-email" className="text-xs text-slate-400">Type <span className="font-semibold text-slate-200">{email}</span> to confirm</label>
              <input id="confirm-email" autoFocus autoComplete="off" value={deleteEmail} onChange={e => setDeleteEmail(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none" />
            </div>
            {deleteError && <p className="text-xs text-red-400">{deleteError}</p>}
            <div className="flex gap-2">
              <button onClick={() => setDeleteOpen(false)} disabled={deleting} className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm text-slate-300 hover:bg-white/10">Cancel</button>
              <button onClick={deleteUser} disabled={deleting || deleteEmail.trim().toLowerCase() !== email.toLowerCase()}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-snow hover:bg-red-700 disabled:opacity-40">
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* ── Habits ── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Habits</h2>
              {topStreak > 0 && (
                <span className="flex items-center gap-1 text-xs text-orange-400 font-medium">
                  <Flame className="h-3 w-3" />{topStreak} streak
                </span>
              )}
              {weekPct !== null && (
                <span className={cn('text-xs font-medium', weekPct >= 70 ? 'text-emerald-400' : weekPct >= 40 ? 'text-amber-400' : 'text-red-400')}>
                  {weekPct}% this week
                </span>
              )}
            </div>
            {editMode && (
              <button onClick={() => setAddingHabit(a => !a)} className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300">
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            )}
          </div>

          {editMode && addingHabit && (
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3 space-y-2">
              <input value={newHabit.habit_name} onChange={e => setNewHabit(p => ({ ...p, habit_name: e.target.value }))}
                placeholder="Habit name" className="w-full bg-slate-800/80 border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:outline-none" />
              <div className="flex gap-2">
                <select value={newHabit.category} onChange={e => setNewHabit(p => ({ ...p, category: e.target.value }))}
                  className="flex-1 bg-slate-800/80 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none">
                  {HABIT_CATEGORIES.map(c => <option key={c} value={c}>{HABIT_CATEGORY_META[c].label}</option>)}
                </select>
                <select value={newHabit.frequency} onChange={e => setNewHabit(p => ({ ...p, frequency: e.target.value }))}
                  className="flex-1 bg-slate-800/80 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none">
                  <option value="daily">Daily</option><option value="weekly">Weekly</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={addHabit} disabled={busy === 'new-habit'} className="flex-1 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs text-snow font-medium flex items-center justify-center gap-1">
                  {busy === 'new-habit' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Save
                </button>
                <button onClick={() => setAddingHabit(false)} className="px-3 py-1.5 rounded-lg border border-white/10 text-xs text-slate-400 hover:text-white">Cancel</button>
              </div>
            </div>
          )}

          {habits.length === 0 && <p className="text-sm text-slate-600">No habits.</p>}
          {habits.map(h => {
            const status = getHabitStatus(h.id)
            return (
              <div key={h.id} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                <div className={cn('h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                  status === 'done' ? 'bg-emerald-500/20 text-emerald-400' : status === 'missed' ? 'bg-red-500/15 text-red-400' : 'bg-white/[0.04] text-slate-600')}>
                  {status === 'done' ? '✓' : status === 'missed' ? '✗' : '·'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {h.is_global && <Globe className="h-3 w-3 text-emerald-400 shrink-0" />}
                    {editMode && !h.is_global
                      ? <InlineText value={h.habit_name} onSave={v => saveHabit(h.id, { habit_name: v })} className="text-sm text-white" />
                      : <span className="text-sm text-white truncate">{h.habit_name}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {editMode && !h.is_global ? (
                      <select value={h.category} onChange={e => saveHabit(h.id, { category: e.target.value })}
                        className="text-[10px] bg-transparent border-0 text-slate-400 focus:outline-none cursor-pointer">
                        {HABIT_CATEGORIES.map(c => <option key={c} value={c}>{HABIT_CATEGORY_META[c].label}</option>)}
                      </select>
                    ) : (
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', CATEGORY_COLOR[h.category] ?? 'text-slate-400 bg-white/5')}>{h.category}</span>
                    )}
                    <span className="text-[10px] text-slate-600">{h.frequency}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-orange-400 text-xs font-medium">
                      <Flame className="h-3 w-3" />{h.streak_count}
                    </div>
                    <span className="text-[10px] text-slate-600">best {h.longest_streak}</span>
                  </div>
                  {editMode && !h.is_global && (
                    <button onClick={() => deleteHabit(h.id)} disabled={busy === h.id}
                      className="text-slate-600 hover:text-red-400 transition-colors">
                      {busy === h.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="space-y-6">
          {/* ── Books ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <BookOpen className="h-3.5 w-3.5" /> Books
              </h2>
              {editMode && (
                <button onClick={() => setAddingBook(a => !a)} className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300">
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              )}
            </div>
            {editMode && addingBook && (
              <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3 space-y-2">
                <input value={newBook.book_title} onChange={e => setNewBook(p => ({ ...p, book_title: e.target.value }))}
                  placeholder="Title" className="w-full bg-slate-800/80 border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:outline-none" />
                <input value={newBook.author} onChange={e => setNewBook(p => ({ ...p, author: e.target.value }))}
                  placeholder="Author" className="w-full bg-slate-800/80 border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:outline-none" />
                <div className="flex gap-2">
                  <select value={newBook.status} onChange={e => setNewBook(p => ({ ...p, status: e.target.value }))}
                    className="flex-1 bg-slate-800/80 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none">
                    <option value="reading">Reading</option><option value="completed">Completed</option><option value="want-to-read">Want to Read</option>
                  </select>
                  <button onClick={addBook} disabled={busy === 'new-book'} className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs text-snow font-medium flex items-center gap-1">
                    {busy === 'new-book' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Add
                  </button>
                  <button onClick={() => setAddingBook(false)} className="px-3 py-1.5 rounded-lg border border-white/10 text-xs text-slate-400 hover:text-white">✕</button>
                </div>
              </div>
            )}
            {books.slice(0, 8).map(b => (
              <div key={b.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 flex items-center gap-3">
                <span className="text-sm text-white truncate flex-1">{b.book_title}</span>
                {editMode ? (
                  <select value={b.status} onChange={e => saveBook(b.id, { status: e.target.value })}
                    className="text-xs bg-transparent border-0 text-slate-400 focus:outline-none cursor-pointer shrink-0">
                    <option value="reading">Reading</option><option value="completed">Completed</option><option value="want-to-read">Want to read</option>
                  </select>
                ) : (
                  <span className={cn('text-xs shrink-0', b.status === 'reading' ? 'text-sky-400' : b.status === 'completed' ? 'text-emerald-400' : 'text-slate-500')}>{b.status}</span>
                )}
                {editMode && (
                  <button onClick={() => deleteBook(b.id)} disabled={busy === b.id} className="text-slate-600 hover:text-red-400 shrink-0 transition-colors">
                    {busy === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>
            ))}
            {books.length === 0 && <p className="text-sm text-slate-600">No books.</p>}
          </div>

          {/* ── Goals ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Target className="h-3.5 w-3.5" /> Goals
              </h2>
              {editMode && (
                <button onClick={() => setAddingGoal(a => !a)} className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300">
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              )}
            </div>
            {editMode && addingGoal && (
              <div className="flex gap-2">
                <input value={newGoal.title} onChange={e => setNewGoal({ title: e.target.value })}
                  onKeyDown={e => e.key === 'Enter' && addGoal()}
                  placeholder="Goal title" className="flex-1 bg-slate-800/80 border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:outline-none" />
                <button onClick={addGoal} disabled={busy === 'new-goal'} className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs text-snow font-medium flex items-center gap-1">
                  {busy === 'new-goal' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                </button>
                <button onClick={() => setAddingGoal(false)} className="px-2 py-1.5 rounded-lg border border-white/10 text-xs text-slate-400 hover:text-white">✕</button>
              </div>
            )}
            {goals.slice(0, 8).map(g => (
              <div key={g.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  {editMode
                    ? <InlineText value={g.title} onSave={v => saveGoal(g.id, { title: v })} className="text-sm text-white" />
                    : <p className="text-sm text-white truncate">{g.title}</p>}
                  {g.target_date && <p className="text-[11px] text-slate-600 mt-0.5">Due {g.target_date}</p>}
                </div>
                {editMode ? (
                  <select value={g.is_completed ? 'completed' : 'active'}
                    onChange={e => {
                      const done = e.target.value === 'completed'
                      setGoals(p => p.map(x => x.id === g.id ? { ...x, is_completed: done } : x))
                      apiPatch('user_goals', g.id, { is_completed: done, completed_at: done ? new Date().toISOString() : null })
                    }}
                    className="text-xs bg-transparent border-0 text-slate-400 focus:outline-none cursor-pointer shrink-0">
                    <option value="active">Active</option><option value="completed">Achieved</option>
                  </select>
                ) : (
                  <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium', g.is_completed ? 'bg-emerald-500/15 text-emerald-300' : 'bg-sky-500/15 text-sky-300')}>
                    {g.is_completed ? 'Achieved' : 'Active'}
                  </span>
                )}
                {editMode && (
                  <button onClick={() => deleteGoal(g.id)} disabled={busy === g.id} className="text-slate-600 hover:text-red-400 shrink-0 transition-colors">
                    {busy === g.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>
            ))}
            {goals.length === 0 && <p className="text-sm text-slate-600">No goals.</p>}
          </div>

          {/* ── Todos ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <CheckSquare className="h-3.5 w-3.5" /> Tasks
              </h2>
              {editMode && (
                <button onClick={() => setAddingTodo(a => !a)} className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300">
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              )}
            </div>
            {editMode && addingTodo && (
              <div className="flex gap-2">
                <input value={newTodo.title} onChange={e => setNewTodo({ title: e.target.value })}
                  onKeyDown={e => e.key === 'Enter' && addTodo()}
                  placeholder="Task title" className="flex-1 bg-slate-800/80 border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:outline-none" />
                <button onClick={addTodo} disabled={busy === 'new-todo'} className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs text-snow font-medium flex items-center gap-1">
                  {busy === 'new-todo' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                </button>
                <button onClick={() => setAddingTodo(false)} className="px-2 py-1.5 rounded-lg border border-white/10 text-xs text-slate-400 hover:text-white">✕</button>
              </div>
            )}
            {todos.slice(0, 10).map(t => (
              <div key={t.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 flex items-center gap-3">
                <button onClick={() => editMode && toggleTodo(t)} disabled={!editMode}
                  className={cn('h-4 w-4 rounded border shrink-0 flex items-center justify-center transition-colors',
                    t.completed ? 'border-emerald-500 bg-emerald-500/20' : 'border-slate-600',
                    editMode && 'cursor-pointer hover:border-emerald-400')}>
                  {t.completed && <Check className="h-2.5 w-2.5 text-emerald-400" />}
                </button>
                <span className={cn('text-sm flex-1 truncate', t.completed ? 'line-through text-slate-500' : 'text-white')}>{t.title}</span>
                {editMode && (
                  <button onClick={() => deleteTodo(t.id)} disabled={busy === t.id} className="text-slate-600 hover:text-red-400 shrink-0 transition-colors">
                    {busy === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>
            ))}
            {todos.length === 0 && <p className="text-sm text-slate-600">No tasks.</p>}
          </div>

          {/* ── Workouts (view only) ── */}
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Dumbbell className="h-3.5 w-3.5" /> Recent Workouts
            </h2>
            {workouts.slice(0, 5).map((w, i) => (
              <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 flex items-center justify-between gap-3">
                <span className="text-sm text-white capitalize">{w.workout_type || 'Workout'}</span>
                <div className="text-right">
                  <span className="text-xs text-slate-500">{fmtDate(w.log_date)}</span>
                  {!!w.duration_mins && <span className="text-xs text-slate-600 block">{w.duration_mins} min</span>}
                </div>
              </div>
            ))}
            {workouts.length === 0 && <p className="text-sm text-slate-600">No workouts logged.</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
