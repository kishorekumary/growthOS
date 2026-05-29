import { notFound } from 'next/navigation'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import UserDetailClient from './UserDetailClient'

function getWeekStart(): string {
  const d = new Date()
  const day = d.getDay() || 7
  d.setDate(d.getDate() - (day - 1))
  return d.toISOString().slice(0, 10)
}

export default async function AdminUserPage({ params }: { params: { userId: string } }) {
  const { userId } = params
  const admin   = createSupabaseAdminClient()
  const supabase = createSupabaseServerClient()

  const [
    { data: authUser, error: authErr },
    { data: profile },
    { data: habits },
    { data: logs },
    { data: books },
    { data: workouts },
    { data: goals },
    { data: todos },
    { data: { user: me } },
  ] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    admin.from('user_profiles').select('*').eq('id', userId).single(),
    admin.from('personality_habits')
      .select('id, habit_name, category, frequency, streak_count, longest_streak, last_done_at, is_keystone, is_global')
      .eq('user_id', userId).order('created_at', { ascending: true }),
    admin.from('habit_logs').select('habit_id, log_date, status')
      .eq('user_id', userId).gte('log_date', getWeekStart()),
    admin.from('reading_log').select('id, book_title, author, status, updated_at')
      .eq('user_id', userId).order('updated_at', { ascending: false }),
    admin.from('workout_logs').select('id, date, exercise_type, duration_min, sets')
      .eq('user_id', userId).order('date', { ascending: false }).limit(10),
    admin.from('user_goals').select('id, title, description, status, target_date')
      .eq('user_id', userId).order('created_at', { ascending: false }),
    admin.from('user_todos').select('id, title, completed, due_date')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(30),
    supabase.auth.getUser(),
  ])

  if (authErr || !authUser) notFound()

  const { data: meProfile } = await supabase
    .from('user_profiles').select('is_superadmin').eq('id', me?.id ?? '').single()

  const today = new Date().toISOString().slice(0, 10)

  return (
    <UserDetailClient
      userId={userId}
      email={authUser.user.email ?? ''}
      profile={profile ?? {}}
      habits={habits ?? []}
      habitLogs={logs ?? []}
      today={today}
      books={books ?? []}
      workouts={workouts ?? []}
      goals={goals ?? []}
      todos={todos ?? []}
      isSuperadmin={meProfile?.is_superadmin ?? false}
    />
  )
}
