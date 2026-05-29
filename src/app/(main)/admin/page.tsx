import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import AdminDashboard from './AdminDashboard'
import type { GlobalGalleryItem } from './AdminDashboard'

function getWeekStart(): string {
  const d = new Date()
  const day = d.getDay() || 7
  d.setDate(d.getDate() - (day - 1))
  return d.toISOString().slice(0, 10)
}

export default async function AdminPage() {
  const adminClient = createSupabaseAdminClient()
  const supabase    = createSupabaseServerClient()

  const [
    { data: { users: authUsers } },
    { data: profiles }, // includes is_superadmin
    { data: habits },
    { data: logs },
    { data: books },
    { data: workouts },
    { data: goals },
    { data: todos },
    { data: globalHabits },
    { data: globalGallery },
  ] = await Promise.all([
    adminClient.auth.admin.listUsers({ perPage: 1000 }),
    adminClient.from('user_profiles').select('id, full_name, avatar_url, is_admin, is_superadmin, created_at'),
    adminClient.from('personality_habits').select('id, user_id, is_global, streak_count').eq('is_global', false),
    adminClient.from('habit_logs').select('user_id, status').gte('log_date', getWeekStart()),
    adminClient.from('reading_log').select('user_id, status'),
    adminClient.from('workout_logs').select('user_id').gte('date', getWeekStart()),
    adminClient.from('user_goals').select('user_id, status'),
    adminClient.from('user_todos').select('user_id, completed'),
    adminClient.from('personality_habits').select('id, habit_name, category, frequency, created_at').eq('is_global', true).order('created_at', { ascending: false }),
    adminClient.from('user_gallery').select('id, url, caption, mime_type, storage_path, created_at').eq('is_global', true).order('created_at', { ascending: false }),
  ])

  // Build per-user stats maps
  const habitCounts: Record<string, number>     = {}
  const maxStreaks:  Record<string, number>     = {}
  for (const h of habits ?? []) {
    habitCounts[h.user_id] = (habitCounts[h.user_id] ?? 0) + 1
    maxStreaks[h.user_id]  = Math.max(maxStreaks[h.user_id] ?? 0, h.streak_count ?? 0)
  }

  const weekDone:   Record<string, number> = {}
  const weekTotal:  Record<string, number> = {}
  for (const l of logs ?? []) {
    weekTotal[l.user_id] = (weekTotal[l.user_id] ?? 0) + 1
    if (l.status === 'done') weekDone[l.user_id] = (weekDone[l.user_id] ?? 0) + 1
  }

  const booksReading:   Record<string, number> = {}
  const booksCompleted: Record<string, number> = {}
  for (const b of books ?? []) {
    if (b.status === 'reading')   booksReading[b.user_id]   = (booksReading[b.user_id]   ?? 0) + 1
    if (b.status === 'completed') booksCompleted[b.user_id] = (booksCompleted[b.user_id] ?? 0) + 1
  }

  const workoutCounts: Record<string, number> = {}
  for (const w of workouts ?? []) {
    workoutCounts[w.user_id] = (workoutCounts[w.user_id] ?? 0) + 1
  }

  const activeGoals: Record<string, number> = {}
  for (const g of goals ?? []) {
    if (g.status === 'active' || !g.status) activeGoals[g.user_id] = (activeGoals[g.user_id] ?? 0) + 1
  }

  const openTodos: Record<string, number> = {}
  for (const t of todos ?? []) {
    if (!t.completed) openTodos[t.user_id] = (openTodos[t.user_id] ?? 0) + 1
  }

  // Get current admin's own user id + role
  const { data: { user: me } } = await supabase.auth.getUser()
  const { data: meProfile } = await supabase.from('user_profiles').select('is_superadmin').eq('id', me?.id ?? '').single()

  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))

  const users = (authUsers ?? []).map(u => ({
    id:             u.id,
    email:          u.email ?? '',
    full_name:      profileMap[u.id]?.full_name ?? '',
    avatar_url:     profileMap[u.id]?.avatar_url ?? null,
    is_admin:       profileMap[u.id]?.is_admin ?? false,
    is_superadmin:  profileMap[u.id]?.is_superadmin ?? false,
    joined:         u.created_at,
    habitCount:     habitCounts[u.id]  ?? 0,
    topStreak:      maxStreaks[u.id]   ?? 0,
    weekDone:       weekDone[u.id]     ?? 0,
    weekTotal:      weekTotal[u.id]    ?? 0,
    booksReading:   booksReading[u.id]   ?? 0,
    booksCompleted: booksCompleted[u.id] ?? 0,
    workoutsWeek:   workoutCounts[u.id] ?? 0,
    activeGoals:    activeGoals[u.id]   ?? 0,
    openTodos:      openTodos[u.id]     ?? 0,
  }))

  const galleryItems: GlobalGalleryItem[] = (globalGallery ?? []).map(r => ({
    id:           r.id,
    url:          r.url,
    caption:      r.caption ?? null,
    mime_type:    r.mime_type ?? null,
    storage_path: r.storage_path,
    created_at:   r.created_at,
  }))

  return (
    <AdminDashboard
      users={users}
      globalHabits={globalHabits ?? []}
      globalGallery={galleryItems}
      meId={me?.id ?? ''}
      isSuperadmin={meProfile?.is_superadmin ?? false}
    />
  )
}
