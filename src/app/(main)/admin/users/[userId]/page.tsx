import { notFound } from 'next/navigation'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import UserDetailClient from './UserDetailClient'
import { loadActivity } from '@/lib/admin/loadActivity'
import { recentEvents } from '@/lib/admin/activity'

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
    { data: rewards },
    { data: notif },
    activity,
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
    admin.from('workout_logs').select('id, log_date, workout_type, duration_mins')
      .eq('user_id', userId).order('log_date', { ascending: false }).limit(10),
    admin.from('user_goals').select('id, title, description, is_completed, target_date')
      .eq('user_id', userId).order('created_at', { ascending: false }),
    admin.from('planner_items').select('id, title, is_completed')
      .eq('user_id', userId).is('ended_at', null).order('created_at', { ascending: false }).limit(30),
    supabase.auth.getUser(),
    admin.from('user_rewards').select('points_balance, current_perfect_streak, longest_perfect_streak').eq('user_id', userId).maybeSingle(),
    admin.from('notification_settings').select('timezone').eq('user_id', userId).maybeSingle(),
    loadActivity(admin, { userId, days: 90, perSource: 25 }),
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
      todos={(todos ?? []).map(t => ({ id: t.id, title: t.title, completed: t.is_completed }))}
      isSuperadmin={meProfile?.is_superadmin ?? false}
      meId={me?.id ?? ''}
      account={{
        joined:        authUser.user.created_at,
        lastSignIn:    authUser.user.last_sign_in_at ?? null,
        emailVerified: !!authUser.user.email_confirmed_at,
        provider:      (authUser.user.app_metadata?.provider as string | undefined) ?? 'email',
        timezone:      notif?.timezone ?? null,
        points:        rewards?.points_balance ?? 0,
        perfectStreak: rewards?.current_perfect_streak ?? 0,
        bestPerfect:   rewards?.longest_perfect_streak ?? 0,
      }}
      activity={recentEvents([
        ...activity,
        ...(authUser.user.last_sign_in_at ? [{ user_id: userId, at: authUser.user.last_sign_in_at, label: 'Signed in' }] : []),
      ], 15)}
    />
  )
}
