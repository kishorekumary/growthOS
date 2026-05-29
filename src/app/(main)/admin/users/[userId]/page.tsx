import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Flame, BookOpen, Dumbbell, Target, CheckSquare, Globe } from 'lucide-react'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { cn } from '@/lib/utils'

function getWeekStart(): string {
  const d = new Date()
  const day = d.getDay() || 7
  d.setDate(d.getDate() - (day - 1))
  return d.toISOString().slice(0, 10)
}

const CATEGORY_COLOR: Record<string, string> = {
  mindset:      'text-violet-300 bg-violet-500/15',
  social:       'text-sky-300 bg-sky-500/15',
  productivity: 'text-emerald-300 bg-emerald-500/15',
}

export default async function AdminUserPage({ params }: { params: { userId: string } }) {
  const { userId } = params
  const admin = createSupabaseAdminClient()

  const [
    { data: authUser, error: authErr },
    { data: profile },
    { data: habits },
    { data: logs },
    { data: books },
    { data: workouts },
    { data: goals },
    { data: todos },
  ] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    admin.from('user_profiles').select('*').eq('id', userId).single(),
    admin.from('personality_habits').select('id, habit_name, category, frequency, streak_count, longest_streak, last_done_at, is_keystone, is_global').eq('user_id', userId).order('created_at', { ascending: true }),
    admin.from('habit_logs').select('habit_id, log_date, status').eq('user_id', userId).gte('log_date', getWeekStart()),
    admin.from('reading_log').select('book_title, author, status, updated_at').eq('user_id', userId).order('updated_at', { ascending: false }),
    admin.from('workout_logs').select('date, exercise_type, duration_min, sets').eq('user_id', userId).order('date', { ascending: false }).limit(10),
    admin.from('user_goals').select('title, description, status, target_date').eq('user_id', userId).order('created_at', { ascending: false }),
    admin.from('user_todos').select('title, completed, due_date').eq('user_id', userId).eq('completed', false).order('created_at', { ascending: false }).limit(20),
  ])

  if (authErr || !authUser) notFound()

  const email      = authUser.user.email ?? ''
  const fullName   = profile?.full_name ?? ''
  const initials   = fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || email[0]?.toUpperCase() || '?'
  const weekStart  = getWeekStart()

  const today = new Date().toISOString().slice(0, 10)
  function getHabitStatus(habitId: string) {
    const log = logs?.find(l => l.habit_id === habitId && l.log_date === today)
    return log?.status ?? 'pending'
  }

  const activeGoals    = goals?.filter(g => g.status === 'active' || !g.status) ?? []
  const completedGoals = goals?.filter(g => g.status === 'completed') ?? []

  const booksReading   = books?.filter(b => b.status === 'reading')   ?? []
  const booksCompleted = books?.filter(b => b.status === 'completed') ?? []

  return (
    <div className="min-h-screen p-4 md:p-8 space-y-6 max-w-5xl mx-auto">
      {/* Back */}
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-white transition-colors">
        <ChevronLeft className="h-4 w-4" />
        Back to Admin
      </Link>

      {/* User header */}
      <div className="flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt={fullName} className="h-14 w-14 rounded-full object-cover ring-2 ring-white/10" />
        ) : (
          <div className="h-14 w-14 rounded-full bg-indigo-500/20 ring-2 ring-indigo-500/20 flex items-center justify-center text-lg font-bold text-indigo-300">
            {initials}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-lg font-bold text-white">{fullName || '—'}</p>
          <p className="text-sm text-slate-500">{email}</p>
          <div className="flex items-center gap-3 mt-1">
            {profile?.occupation && <span className="text-xs text-slate-600">{profile.occupation}</span>}
            {profile?.country && <span className="text-xs text-slate-600">{profile.country}</span>}
            {profile?.is_admin && <span className="text-xs px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300 font-medium">Admin</span>}
          </div>
        </div>
        {/* Quick section counts */}
        <div className="hidden md:grid grid-cols-3 gap-3 text-center">
          {[
            { icon: Dumbbell, label: 'Workouts', value: workouts?.length ?? 0, sub: 'recent 10' },
            { icon: BookOpen,  label: 'Books',    value: (booksReading.length + booksCompleted.length), sub: `${booksCompleted.length} done` },
            { icon: Target,    label: 'Goals',    value: activeGoals.length, sub: `${completedGoals.length} done` },
          ].map(({ icon: Icon, label, value, sub }) => (
            <div key={label} className="rounded-lg border border-white/[0.06] px-3 py-2">
              <Icon className="h-3.5 w-3.5 text-slate-500 mx-auto mb-1" />
              <p className="text-base font-bold text-white">{value}</p>
              <p className="text-[10px] text-slate-500">{label}</p>
              <p className="text-[10px] text-slate-600">{sub}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Habits */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Habits</h2>
          {habits?.length === 0 && <p className="text-sm text-slate-600">No habits yet.</p>}
          {habits?.map(h => {
            const status = getHabitStatus(h.id)
            return (
              <div key={h.id} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                <div className={cn(
                  'h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                  status === 'done'   ? 'bg-emerald-500/20 text-emerald-400'
                  : status === 'missed' ? 'bg-red-500/15 text-red-400'
                  :                       'bg-white/[0.04] text-slate-600',
                )}>
                  {status === 'done' ? '✓' : status === 'missed' ? '✗' : '·'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {h.is_global && <Globe className="h-3 w-3 text-emerald-400 shrink-0" />}
                    <span className="text-sm text-white truncate">{h.habit_name}</span>
                    {h.is_keystone && <span className="text-[10px] px-1 rounded bg-amber-500/15 text-amber-400 font-medium shrink-0">★</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', CATEGORY_COLOR[h.category] ?? 'text-slate-400 bg-white/5')}>
                      {h.category}
                    </span>
                    <span className="text-[10px] text-slate-600">{h.frequency}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="flex items-center gap-1 text-orange-400 text-xs font-medium">
                    <Flame className="h-3 w-3" />{h.streak_count}
                  </div>
                  <span className="text-[10px] text-slate-600">best {h.longest_streak}</span>
                </div>
              </div>
            )
          })}
        </div>

        <div className="space-y-6">
          {/* Books */}
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <BookOpen className="h-3.5 w-3.5" /> Books
            </h2>
            {booksReading.slice(0, 5).map((b, i) => (
              <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 flex items-center justify-between gap-3">
                <span className="text-sm text-white truncate">{b.book_title}</span>
                <span className="text-xs text-sky-400 shrink-0">reading</span>
              </div>
            ))}
            {booksCompleted.slice(0, 3).map((b, i) => (
              <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 flex items-center justify-between gap-3 opacity-60">
                <span className="text-sm text-white truncate">{b.book_title}</span>
                <span className="text-xs text-emerald-400 shrink-0">done</span>
              </div>
            ))}
            {(booksReading.length + booksCompleted.length) === 0 && <p className="text-sm text-slate-600">No books.</p>}
          </div>

          {/* Active Goals */}
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Target className="h-3.5 w-3.5" /> Active Goals
            </h2>
            {activeGoals.slice(0, 5).map((g, i) => (
              <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5">
                <p className="text-sm text-white">{g.title}</p>
                {g.target_date && <p className="text-[11px] text-slate-600 mt-0.5">Due {g.target_date}</p>}
              </div>
            ))}
            {activeGoals.length === 0 && <p className="text-sm text-slate-600">No active goals.</p>}
          </div>

          {/* Open Todos */}
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <CheckSquare className="h-3.5 w-3.5" /> Open Tasks
            </h2>
            {todos?.slice(0, 5).map((t, i) => (
              <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 flex items-center gap-2">
                <div className="h-3.5 w-3.5 rounded border border-slate-600 shrink-0" />
                <span className="text-sm text-white truncate">{t.title}</span>
              </div>
            ))}
            {(todos?.length ?? 0) === 0 && <p className="text-sm text-slate-600">No open tasks.</p>}
          </div>

          {/* Recent Workouts */}
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Dumbbell className="h-3.5 w-3.5" /> Recent Workouts
            </h2>
            {workouts?.slice(0, 5).map((w, i) => (
              <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 flex items-center justify-between gap-3">
                <span className="text-sm text-white capitalize">{w.exercise_type || 'Workout'}</span>
                <div className="text-right">
                  <span className="text-xs text-slate-500">{w.date}</span>
                  {w.duration_min && <span className="text-xs text-slate-600 block">{w.duration_min} min</span>}
                </div>
              </div>
            ))}
            {(workouts?.length ?? 0) === 0 && <p className="text-sm text-slate-600">No workouts logged.</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
