import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { openai } from '@/lib/claude'
import { format, startOfWeek, endOfWeek, subWeeks } from 'date-fns'

export async function POST() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const uid       = user.id
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const weekEnd   = format(endOfWeek(new Date(),   { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const prevStart = format(startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 }), 'yyyy-MM-dd')

  // Check cache
  const { data: cached } = await supabase
    .from('weekly_digests')
    .select('content')
    .eq('user_id', uid)
    .eq('week_start', weekStart)
    .maybeSingle()

  if (cached) return NextResponse.json({ digest: cached.content, cached: true })

  const admin = createSupabaseAdminClient()

  // Gather data from all domains in parallel
  const [
    { data: todos },
    { data: habits },
    { data: habitLogs },
    { data: workouts },
    { data: books },
    { data: goals },
    { data: moodCheckins },
    { data: sleepLogs },
    { data: focusSessions },
    { data: routineCompletions },
    { data: expenses },
  ] = await Promise.all([
    admin.from('user_todos').select('is_completed,title,due_date,priority').eq('user_id', uid).gte('due_date', weekStart).lte('due_date', weekEnd),
    admin.from('user_habits').select('habit_name,streak_count,category').eq('user_id', uid),
    admin.from('habit_logs').select('habit_id,status,log_date').eq('user_id', uid).gte('log_date', weekStart),
    admin.from('workout_logs').select('workout_type,duration_minutes,workout_date').eq('user_id', uid).gte('workout_date', weekStart),
    admin.from('reading_log').select('book_title,status,author').eq('user_id', uid),
    admin.from('user_goals').select('title,category,is_completed,target_date').eq('user_id', uid).eq('is_completed', false),
    admin.from('mood_checkins').select('mood,energy,word,checked_at').eq('user_id', uid).gte('checked_at', weekStart),
    admin.from('sleep_logs').select('bedtime,wake_time,quality,sleep_date').eq('user_id', uid).gte('sleep_date', weekStart),
    admin.from('focus_sessions').select('id,duration_minutes').eq('user_id', uid).gte('created_at', weekStart).limit(50),
    admin.from('routine_completions').select('routine_id,completed_date').eq('user_id', uid).gte('completed_date', weekStart),
    admin.from('expense_logs').select('amount,category,description').eq('user_id', uid).gte('expense_date', weekStart).limit(100),
  ])

  // Calculate sleep hours helper
  function sleepHours(bedtime: string, wakeTime: string): number {
    const [bh, bm] = bedtime.slice(0, 5).split(':').map(Number)
    const [wh, wm] = wakeTime.slice(0, 5).split(':').map(Number)
    let mins = (wh * 60 + wm) - (bh * 60 + bm)
    if (mins < 0) mins += 24 * 60
    return Math.round(mins / 60 * 10) / 10
  }

  // Build data summary for Claude
  const todoList = todos ?? []
  const completedTodos = todoList.filter(t => t.is_completed)
  const pendingTodos   = todoList.filter(t => !t.is_completed)

  const workoutList = workouts ?? []
  const totalWorkoutMins = workoutList.reduce((s, w) => s + (w.duration_minutes ?? 0), 0)

  const moodList = moodCheckins ?? []
  const avgMood   = moodList.length ? (moodList.reduce((s, m) => s + m.mood,   0) / moodList.length).toFixed(1) : null
  const avgEnergy = moodList.length ? (moodList.reduce((s, m) => s + m.energy, 0) / moodList.length).toFixed(1) : null

  const sleepList = sleepLogs ?? []
  const avgSleepHrs = sleepList.length
    ? (sleepList.reduce((s, l) => s + sleepHours(l.bedtime, l.wake_time), 0) / sleepList.length).toFixed(1)
    : null

  const focusList = focusSessions ?? []
  const totalFocusMins = focusList.reduce((s, f) => s + (f.duration_minutes ?? 25), 0)

  const expenseList = expenses ?? []
  const totalSpent = expenseList.reduce((s, e) => s + (e.amount ?? 0), 0)

  const habitLogList = habitLogs ?? []
  const habitsDone = habitLogList.filter(h => h.status === 'done').length

  const bookList = books ?? []
  const readingNow  = bookList.filter(b => b.status === 'reading')
  const completed   = bookList.filter(b => b.status === 'completed')

  const dataContext = `
Week: ${weekStart} to ${weekEnd}

TASKS: ${completedTodos.length} completed out of ${todoList.length} due this week.
Pending: ${pendingTodos.slice(0, 3).map(t => t.title).join(', ') || 'none'}

HABITS: ${habitsDone} habit check-ins logged this week.
Active habits: ${(habits ?? []).map(h => `${h.habit_name} (streak: ${h.streak_count})`).join(', ') || 'none'}

FITNESS: ${workoutList.length} workouts totaling ${totalWorkoutMins} minutes.
${workoutList.map(w => `${w.workout_type} (${w.duration_minutes}min)`).join(', ')}

FOCUS: ${focusList.length} focus sessions, ${totalFocusMins} minutes total.

BOOKS: Currently reading: ${readingNow.map(b => b.book_title).join(', ') || 'none'}. Total completed: ${completed.length}.

MOOD: Average mood ${avgMood ?? 'not tracked'}/5, Energy ${avgEnergy ?? 'not tracked'}/5. Check-ins: ${moodList.length} days.

SLEEP: Average ${avgSleepHrs ?? 'not tracked'} hours/night over ${sleepList.length} days logged.

FINANCES: ₹${totalSpent.toFixed(0)} spent across ${expenseList.length} transactions.

GOALS: ${(goals ?? []).length} active goals: ${(goals ?? []).slice(0, 5).map(g => `${g.title} (${g.category})`).join(', ')}

ROUTINES: ${(routineCompletions ?? []).length} routine completions this week.
  `.trim()

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `You are a personal growth coach generating a weekly digest for your client. Based on this week's data, write an insightful, warm, and actionable weekly review. Be specific, not generic.

DATA:
${dataContext}

Return a JSON object with these exact fields:
{
  "headline": "one punchy sentence summarizing the week (max 12 words)",
  "wins": ["2-3 specific wins from the data"],
  "insight": "one paragraph (3-4 sentences) with a key pattern or correlation you notice",
  "focus_next_week": ["3 specific, actionable recommendations for next week"],
  "score": <overall week score 1-10 based on activity>,
  "score_reason": "one sentence explaining the score"
}

Return only valid JSON, no markdown.`,
    }],
  })

  const raw = (response.choices[0]?.message?.content ?? '').trim()
  let digest
  try {
    digest = JSON.parse(raw)
  } catch {
    digest = { headline: 'Your week in review', wins: [], insight: raw, focus_next_week: [], score: 7, score_reason: '' }
  }

  // Cache it
  await supabase.from('weekly_digests').upsert({
    user_id: uid,
    week_start: weekStart,
    content: digest,
  }, { onConflict: 'user_id,week_start' })

  return NextResponse.json({ digest, cached: false })
}
