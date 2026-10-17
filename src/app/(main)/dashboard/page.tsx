import Link from 'next/link'
import { format, startOfWeek } from 'date-fns'
import { Brain, Dumbbell, Wallet, BookOpen, ArrowRight, Flame, Trophy, TrendingUp, BookMarked } from 'lucide-react'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import DailyGreetingCard from '@/components/shared/DailyGreetingCard'
import DailyPractice from '@/components/shared/DailyPractice'
import QuickReset from '@/components/shared/QuickReset'
import PlannerWidget from '@/components/planner/PlannerWidget'
import DashboardGoalsCard from '@/components/goals/DashboardGoalsCard'
import TodayHabits from '@/components/dashboard/TodayHabits'
import RewardsProgressCard from '@/components/dashboard/RewardsProgressCard'
import ThemeToggle from '@/components/layout/ThemeToggle'
import PowerQuestions from '@/components/dashboard/PowerQuestions'
import DecisionsDue from '@/components/dashboard/DecisionsDue'
import WorkbookDue from '@/components/dashboard/WorkbookDue'

// YYYY-MM-DD for `date` in an IANA timezone ('en-CA' formats as ISO).
function dateIn(timezone: string, date: Date): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
  } catch {
    return date.toISOString().slice(0, 10)
  }
}

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')

  const [
    { data: profile },
    { data: habits },
    { data: hiddenMarks },
    { data: notificationSettings },
    { data: workouts },
    { data: financeProfile },
    { data: completedBooks },
    { data: currentBook },
    { data: activeGoals },
  ] = await Promise.all([
    supabase.from('user_profiles').select('full_name').eq('id', user.id).single(),
    // Same set the habit tracker shows: own habits plus global ones, minus
    // any global habit this user has hidden.
    supabase.from('personality_habits').select('id, streak_count, last_done_at, is_global')
      .or(`user_id.eq.${user.id},is_global.eq.true`),
    supabase.from('user_hidden_habits').select('habit_id').eq('user_id', user.id),
    supabase.from('notification_settings').select('timezone').eq('user_id', user.id).maybeSingle(),
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
      .from('user_goals')
      .select('id, title, category, timeframe, target_date, is_completed')
      .eq('user_id', user.id)
      .eq('is_completed', false)
      .order('target_date', { ascending: true, nullsFirst: false }),
  ])

  const hiddenIds = new Set((hiddenMarks ?? []).map(h => h.habit_id))
  const visibleHabits = (habits ?? []).filter(h => !h.is_global || !hiddenIds.has(h.id))
  const activeHabits = visibleHabits.length

  // streak_count isn't reset when a day is missed, so only count streaks
  // still alive (done today or yesterday in the user's timezone) — same rule
  // as TodayHabits. Global habits share one streak column across users, so
  // they're left out.
  const tz = notificationSettings?.timezone ?? 'UTC'
  const now = new Date()
  const localToday = dateIn(tz, now)
  const localYesterday = dateIn(tz, new Date(now.getTime() - 24 * 60 * 60 * 1000))
  const maxStreak = visibleHabits.reduce((max, h) => {
    if (h.is_global || !h.last_done_at || h.streak_count <= 0) return max
    const last = dateIn(tz, new Date(h.last_done_at))
    return last === localToday || last === localYesterday ? Math.max(max, h.streak_count) : max
  }, 0)
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
      subStat: maxStreak > 0 ? `${maxStreak} day streak` : activeHabits > 0 ? 'Start a streak today' : 'Start your first habit',
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
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500 mb-1">{today}</p>
          <h1 className="text-2xl font-bold text-white">
            Today
          </h1>
        </div>
        {/* Phones have it in the top bar (src/app/(main)/layout.tsx). */}
        <ThemeToggle className="hidden md:flex" />
      </div>

      {/* Today's habits first — opening the app should be enough to act */}
      <div className="mb-6">
        <TodayHabits />
      </div>

      {/* What the points are worth — moves as habits are checked off */}
      <div className="mb-6 empty:hidden">
        <RewardsProgressCard />
      </div>

      <div className="mb-6">
        <PowerQuestions />
      </div>

      {/* Renders only when a decision check-in is due */}
      <div className="mb-6 empty:hidden">
        <DecisionsDue />
      </div>

      {/* Renders only when a workbook exercise is due */}
      <div className="mb-6 empty:hidden">
        <WorkbookDue />
      </div>

      {/* AI Daily Greeting */}
      <div className="mb-6">
        <DailyGreetingCard firstName={firstName} />
      </div>

      {/* Today's Plan widget */}
      <div className="mb-6">
        <PlannerWidget />
      </div>

      {/* Section cards — 2×2 grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {sections.map(({ title, href, icon: Icon, gradient, border, iconBg, iconColor, stat, subStat, subIcon: SubIcon }) => (
          <Link
            key={title}
            href={href}
            className={`card-sheen group relative overflow-hidden rounded-xl border ${border} bg-gradient-to-br ${gradient} p-5 flex flex-col gap-4 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 active:scale-[0.98] motion-reduce:transform-none`}
          >
            {/* Soft glow in the corner, in the section's colour */}
            <div aria-hidden className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl opacity-60 ${iconBg}`} />

            {/* Icon + title */}
            <div className="relative flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconBg}`}>
                <Icon className={`h-4 w-4 ${iconColor}`} />
              </div>
              <span className="font-semibold text-white">{title}</span>
            </div>

            {/* Stats */}
            <div className="relative flex-1">
              <p className="text-base font-semibold text-white">{stat}</p>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                {SubIcon && <SubIcon className="h-3 w-3" />}
                {subStat}
              </p>
            </div>

            {/* The whole card is the link; this is its affordance */}
            <span className={`relative inline-flex items-center gap-1.5 text-xs font-medium ${iconColor}`}>
              Open
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>

      {/* Quick Reset */}
      <div className="mt-6">
        <QuickReset />
      </div>

      {/* Goals overview */}
      <div className="mt-4">
        <DashboardGoalsCard goals={activeGoals ?? []} />
      </div>

      {/* Daily Practice — pledge, affirmations, gratitude */}
      <div className="mt-4">
        <DailyPractice />
      </div>
    </div>
  )
}
