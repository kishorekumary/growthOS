import Link from 'next/link'
import { format, startOfWeek } from 'date-fns'
import { Brain, Dumbbell, Wallet, BookOpen, ArrowRight, Flame, Trophy, TrendingUp, BookMarked } from 'lucide-react'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import DailyGreetingCard from '@/components/shared/DailyGreetingCard'
import DailyPractice from '@/components/shared/DailyPractice'
import TodoWidget from '@/components/todos/TodoWidget'

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')

  const todayStr = format(new Date(), 'yyyy-MM-dd')

  const [
    { data: profile },
    { data: habits },
    { data: workouts },
    { data: financeProfile },
    { data: completedBooks },
    { data: currentBook },
    { data: todayTodos },
  ] = await Promise.all([
    supabase.from('user_profiles').select('full_name').eq('id', user.id).single(),
    supabase.from('personality_habits').select('streak_count').eq('user_id', user.id),
    supabase.from('workout_logs').select('id').eq('user_id', user.id).gte('log_date', weekStart),
    supabase.from('financial_profile').select('financial_score').eq('user_id', user.id).single(),
    supabase.from('reading_log').select('id').eq('user_id', user.id).eq('status', 'completed'),
    supabase
      .from('reading_log')
      .select('book_title')
      .eq('user_id', user.id)
      .eq('status', 'reading')
      .limit(1)
      .maybeSingle(),
    supabase
      .from('user_todos')
      .select('id, title, notes, due_date, is_completed')
      .eq('user_id', user.id)
      .eq('is_completed', false)
      .or(`due_date.is.null,due_date.lte.${todayStr}`)
      .order('due_date', { ascending: true, nullsFirst: true })
      .order('created_at', { ascending: false })
      .limit(6),
  ])

  const activeHabits = habits?.filter((h) => h.streak_count > 0).length ?? 0
  const maxStreak = habits?.reduce((max, h) => Math.max(max, h.streak_count), 0) ?? 0
  const workoutsThisWeek = workouts?.length ?? 0
  const financialScore = financeProfile?.financial_score ?? null
  const booksCompleted = completedBooks?.length ?? 0
  const currentBookTitle = currentBook?.book_title ?? null
  const firstName = profile?.full_name?.split(' ')[0] ?? 'there'
  const today = format(new Date(), 'EEEE, MMMM d')

  const sections = [
    {
      title: 'Personality',
      href: '/personality',
      icon: Brain,
      gradient: 'from-violet-500/20 to-violet-500/5',
      border: 'border-violet-500/20',
      iconBg: 'bg-violet-500/20',
      iconColor: 'text-violet-400',
      stat: activeHabits > 0 ? `${activeHabits} active habit${activeHabits !== 1 ? 's' : ''}` : 'No habits yet',
      subStat: maxStreak > 0 ? `${maxStreak} day streak` : 'Start your first habit',
      subIcon: maxStreak > 0 ? Flame : null,
    },
    {
      title: 'Fitness',
      href: '/fitness',
      icon: Dumbbell,
      gradient: 'from-emerald-500/20 to-emerald-500/5',
      border: 'border-emerald-500/20',
      iconBg: 'bg-emerald-500/20',
      iconColor: 'text-emerald-400',
      stat: `${workoutsThisWeek} workout${workoutsThisWeek !== 1 ? 's' : ''} this week`,
      subStat: workoutsThisWeek >= 3 ? 'On track!' : 'Keep going',
      subIcon: workoutsThisWeek >= 3 ? Trophy : null,
    },
    {
      title: 'Finance',
      href: '/finance',
      icon: Wallet,
      gradient: 'from-amber-500/20 to-amber-500/5',
      border: 'border-amber-500/20',
      iconBg: 'bg-amber-500/20',
      iconColor: 'text-amber-400',
      stat: financialScore !== null ? `Score: ${financialScore}/100` : 'Not set up yet',
      subStat: financialScore !== null
        ? financialScore >= 70 ? 'Great shape' : financialScore >= 40 ? 'Room to grow' : 'Needs attention'
        : 'Set up your profile',
      subIcon: financialScore !== null ? TrendingUp : null,
    },
    {
      title: 'Books',
      href: '/books',
      icon: BookOpen,
      gradient: 'from-sky-500/20 to-sky-500/5',
      border: 'border-sky-500/20',
      iconBg: 'bg-sky-500/20',
      iconColor: 'text-sky-400',
      stat: `${booksCompleted} book${booksCompleted !== 1 ? 's' : ''} completed`,
      subStat: currentBookTitle ? `Reading: ${currentBookTitle}` : 'Nothing in progress',
      subIcon: currentBookTitle ? BookMarked : null,
    },
  ]

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-8">
      {/* Header */}
      <div className="mb-6">
        <p className="text-sm text-slate-500 mb-1">{today}</p>
        <h1 className="text-2xl font-bold text-white">
          Your Dashboard
        </h1>
      </div>

      {/* AI Daily Greeting */}
      <div className="mb-6">
        <DailyGreetingCard firstName={firstName} />
      </div>

      {/* Today's Tasks widget */}
      <div className="mb-6">
        <TodoWidget initialTodos={todayTodos ?? []} />
      </div>

      {/* Section cards — 2×2 grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {sections.map(({ title, href, icon: Icon, gradient, border, iconBg, iconColor, stat, subStat, subIcon: SubIcon }) => (
          <div
            key={title}
            className={`rounded-xl border ${border} bg-gradient-to-br ${gradient} p-5 flex flex-col gap-4`}
          >
            {/* Icon + title */}
            <div className="flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconBg}`}>
                <Icon className={`h-4 w-4 ${iconColor}`} />
              </div>
              <span className="font-semibold text-white">{title}</span>
            </div>

            {/* Stats */}
            <div className="flex-1">
              <p className="text-base font-semibold text-white">{stat}</p>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                {SubIcon && <SubIcon className="h-3 w-3" />}
                {subStat}
              </p>
            </div>

            {/* Open button */}
            <Link
              href={href}
              className={`inline-flex items-center gap-1.5 text-xs font-medium ${iconColor} hover:opacity-80 transition-opacity`}
            >
              Open
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ))}
      </div>

      {/* Daily Practice — pledge, affirmations, gratitude */}
      <div className="mt-8">
        <DailyPractice />
      </div>
    </div>
  )
}
