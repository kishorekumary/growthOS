import { createSupabaseServerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { Smile } from 'lucide-react'
import dynamic from 'next/dynamic'
import type { LifeScores } from '@/components/checkin/WheelOfLife'
import { format, subDays, startOfWeek } from 'date-fns'

const MoodCheckin  = dynamic(() => import('@/components/checkin/MoodCheckin'),  { ssr: false })
const SleepTracker = dynamic(() => import('@/components/checkin/SleepTracker'), { ssr: false })
const WheelOfLife  = dynamic(() => import('@/components/checkin/WheelOfLife'),  { ssr: false })

function clamp(v: number, max: number): number {
  return Math.max(1, Math.min(10, Math.round(v)))
}

export default async function CheckinPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const uid = user.id
  const today      = format(new Date(), 'yyyy-MM-dd')
  const weekStart  = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const twoWeekAgo = format(subDays(new Date(), 13), 'yyyy-MM-dd')

  const [
    { data: todos },
    { data: habits },
    { data: focusSessions },
    { data: workouts },
    { data: books },
    { data: goals },
    { data: moodCheckins },
    { data: sleepLogs },
    { data: expenses },
  ] = await Promise.all([
    supabase.from('user_todos').select('is_completed,due_date').eq('user_id', uid).gte('due_date', weekStart),
    supabase.from('user_habits').select('streak_count,longest_streak').eq('user_id', uid),
    supabase.from('focus_sessions').select('id').eq('user_id', uid).gte('created_at', weekStart).limit(20),
    supabase.from('workout_logs').select('workout_date').eq('user_id', uid).gte('workout_date', weekStart),
    supabase.from('reading_log').select('status').eq('user_id', uid),
    supabase.from('user_goals').select('is_completed').eq('user_id', uid),
    supabase.from('mood_checkins').select('mood,energy').eq('user_id', uid).gte('checked_at', twoWeekAgo),
    supabase.from('sleep_logs').select('bedtime,wake_time,quality').eq('user_id', uid).gte('sleep_date', twoWeekAgo),
    supabase.from('expense_logs').select('id').eq('user_id', uid).gte('expense_date', weekStart).limit(20),
  ])

  // ── Score calculations ────────────────────────────────────────
  // Finance: tracked expenses this week (activity = good)
  const expenseCount = expenses?.length ?? 0
  const financeScore = clamp(expenseCount >= 5 ? 8 : expenseCount >= 2 ? 6 : expenseCount >= 1 ? 4 : 2, 10)

  // Fitness: workouts this week
  const workoutCount = workouts?.length ?? 0
  const fitnessScore = clamp(workoutCount >= 4 ? 10 : workoutCount * 2.5 + 1, 10)

  // Focus: focus sessions this week
  const focusCount = focusSessions?.length ?? 0
  const focusScore = clamp(focusCount >= 5 ? 10 : focusCount * 1.8 + 1, 10)

  // Knowledge: books in reading/completed
  const activeBooks = (books ?? []).filter(b => b.status !== 'want_to_read').length
  const knowledgeScore = clamp(activeBooks >= 4 ? 10 : activeBooks * 2 + 2, 10)

  // Habits: average streak relative to longest
  const habitList = habits ?? []
  const avgStreak = habitList.length
    ? habitList.reduce((s, h) => s + (h.streak_count ?? 0), 0) / habitList.length
    : 0
  const habitsScore = clamp(avgStreak >= 7 ? 10 : avgStreak * 1.3 + 1, 10)

  // Goals: completion ratio
  const goalList = goals ?? []
  const completedGoals = goalList.filter(g => g.is_completed).length
  const goalRatio = goalList.length ? completedGoals / goalList.length : 0
  const goalsScore = clamp(goalRatio * 8 + (goalList.length > 0 ? 2 : 1), 10)

  // Sleep: average quality or hours
  const sleepList = sleepLogs ?? []
  const avgSleepQuality = sleepList.length
    ? sleepList.reduce((s, l) => s + (l.quality ?? 3), 0) / sleepList.length
    : 0
  const sleepScore = sleepList.length ? clamp(avgSleepQuality * 2, 10) : 3

  // Mood: average mood
  const moodList = moodCheckins ?? []
  const avgMood = moodList.length
    ? moodList.reduce((s, m) => s + m.mood, 0) / moodList.length
    : 0
  const moodScore = moodList.length ? clamp(avgMood * 2, 10) : 3

  const scores: LifeScores = {
    finance:   financeScore,
    fitness:   fitnessScore,
    focus:     focusScore,
    knowledge: knowledgeScore,
    habits:    habitsScore,
    goals:     goalsScore,
    sleep:     sleepScore,
    mood:      moodScore,
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 border border-emerald-500/30">
            <Smile className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Daily Check-in</h1>
            <p className="text-sm text-slate-500">Mood · Sleep · Life Balance</p>
          </div>
        </div>

        {/* Wheel of Life (server-calculated, client-rendered) */}
        <WheelOfLife scores={scores} />

        {/* Mood & Energy */}
        <MoodCheckin />

        {/* Sleep */}
        <SleepTracker />
      </div>
    </div>
  )
}
