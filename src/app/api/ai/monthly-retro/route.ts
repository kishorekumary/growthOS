import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { openai } from '@/lib/claude'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'

export async function POST() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const uid        = user.id
  const prevMonth  = subMonths(new Date(), 1)
  const monthStart = format(startOfMonth(prevMonth), 'yyyy-MM-dd')
  const monthEnd   = format(endOfMonth(prevMonth), 'yyyy-MM-dd')
  const monthLabel = format(prevMonth, 'MMMM yyyy')

  // Check cache
  const { data: cached } = await supabase
    .from('monthly_retros')
    .select('content')
    .eq('user_id', uid)
    .eq('month_start', monthStart)
    .maybeSingle()

  if (cached) return NextResponse.json({ retro: cached.content, cached: true })

  const admin = createSupabaseAdminClient()

  const [
    { data: todos },
    { data: habits },
    { data: habitLogs },
    { data: workouts },
    { data: goals },
    { data: completedGoals },
    { data: moodCheckins },
    { data: sleepLogs },
    { data: focusSessions },
    { data: routineCompletions },
    { data: expenses },
    { data: journalEntries },
    { data: books },
  ] = await Promise.all([
    admin.from('user_todos').select('is_completed,title,priority').eq('user_id', uid).gte('due_date', monthStart).lte('due_date', monthEnd),
    admin.from('user_habits').select('habit_name,streak_count,longest_streak,category').eq('user_id', uid),
    admin.from('habit_logs').select('status,log_date').eq('user_id', uid).gte('log_date', monthStart).lte('log_date', monthEnd),
    admin.from('workout_logs').select('workout_type,duration_minutes,workout_date').eq('user_id', uid).gte('workout_date', monthStart).lte('workout_date', monthEnd),
    admin.from('user_goals').select('title,category,is_completed,target_date').eq('user_id', uid),
    admin.from('user_goals').select('title,category').eq('user_id', uid).eq('is_completed', true).gte('updated_at', monthStart).lte('updated_at', monthEnd),
    admin.from('mood_checkins').select('mood,energy,word,checked_at').eq('user_id', uid).gte('checked_at', monthStart).lte('checked_at', monthEnd),
    admin.from('sleep_logs').select('bedtime,wake_time,quality,sleep_date').eq('user_id', uid).gte('sleep_date', monthStart).lte('sleep_date', monthEnd),
    admin.from('focus_sessions').select('duration_minutes').eq('user_id', uid).gte('created_at', monthStart).lte('created_at', monthEnd).limit(200),
    admin.from('routine_completions').select('completed_date').eq('user_id', uid).gte('completed_date', monthStart).lte('completed_date', monthEnd),
    admin.from('expense_logs').select('amount,category,description').eq('user_id', uid).gte('expense_date', monthStart).lte('expense_date', monthEnd).limit(200),
    admin.from('journal_entries').select('title,content,mood,entry_date').eq('user_id', uid).gte('entry_date', monthStart).lte('entry_date', monthEnd).order('entry_date'),
    admin.from('reading_log').select('book_title,status,author').eq('user_id', uid),
  ])

  function sleepHours(bedtime: string, wakeTime: string): number {
    const [bh, bm] = bedtime.slice(0, 5).split(':').map(Number)
    const [wh, wm] = wakeTime.slice(0, 5).split(':').map(Number)
    let mins = (wh * 60 + wm) - (bh * 60 + bm)
    if (mins < 0) mins += 24 * 60
    return Math.round(mins / 60 * 10) / 10
  }

  const todoList     = todos ?? []
  const workoutList  = workouts ?? []
  const moodList     = moodCheckins ?? []
  const sleepList    = sleepLogs ?? []
  const focusList    = focusSessions ?? []
  const expenseList  = expenses ?? []
  const habitLogList = habitLogs ?? []
  const journalList  = journalEntries ?? []
  const bookList     = books ?? []

  const completedTodos   = todoList.filter(t => t.is_completed).length
  const totalWorkoutMins = workoutList.reduce((s, w) => s + (w.duration_minutes ?? 0), 0)
  const avgMood          = moodList.length ? (moodList.reduce((s, m) => s + m.mood, 0) / moodList.length).toFixed(1) : null
  const avgEnergy        = moodList.length ? (moodList.reduce((s, m) => s + m.energy, 0) / moodList.length).toFixed(1) : null
  const avgSleepHrs      = sleepList.length ? (sleepList.reduce((s, l) => s + sleepHours(l.bedtime, l.wake_time), 0) / sleepList.length).toFixed(1) : null
  const totalFocusMins   = focusList.reduce((s, f) => s + (f.duration_minutes ?? 25), 0)
  const totalSpent       = expenseList.reduce((s, e) => s + (e.amount ?? 0), 0)
  const habitsDone       = habitLogList.filter(h => h.status === 'done').length
  const readingNow       = bookList.filter(b => b.status === 'reading').map(b => b.book_title)
  const completedBooks   = bookList.filter(b => b.status === 'completed').length

  // Expense breakdown
  const expenseByCategory = expenseList.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.amount
    return acc
  }, {})
  const topCategories = Object.entries(expenseByCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([c, v]) => `${c}: ₹${v.toFixed(0)}`)

  // Journal mood words
  const journalWords = journalList
    .filter(j => j.mood)
    .slice(0, 5)
    .map(j => `"${j.title || j.content.slice(0, 40)}…" (mood: ${j.mood}/5)`)

  const dataContext = `
Month: ${monthLabel}

TASKS: ${completedTodos} completed out of ${todoList.length} due tasks.

HABITS: ${habitsDone} habit check-ins done. Active habits: ${(habits ?? []).map(h => `${h.habit_name} (streak: ${h.streak_count}, best: ${h.longest_streak})`).join(', ') || 'none'}

FITNESS: ${workoutList.length} workouts, ${totalWorkoutMins} minutes total.
Types: ${Array.from(new Set(workoutList.map(w => w.workout_type))).join(', ') || 'none'}

FOCUS: ${focusList.length} sessions, ${totalFocusMins} total minutes focused.

SLEEP: Average ${avgSleepHrs ?? 'not tracked'} hours/night over ${sleepList.length} nights.

MOOD: Average mood ${avgMood ?? 'not tracked'}/5, Energy ${avgEnergy ?? 'not tracked'}/5 across ${moodList.length} check-ins.

FINANCES: ₹${totalSpent.toFixed(0)} across ${expenseList.length} transactions.
Top categories: ${topCategories.join(', ') || 'none'}

GOALS: ${(goals ?? []).length} total goals, ${(completedGoals ?? []).length} completed this month.
Completed this month: ${(completedGoals ?? []).map(g => g.title).join(', ') || 'none'}

READING: Currently reading ${readingNow.join(', ') || 'nothing'}, ${completedBooks} books completed overall.

ROUTINES: ${(routineCompletions ?? []).length} routine completions.

JOURNAL: ${journalList.length} entries written.
${journalWords.length ? 'Highlights: ' + journalWords.join(' | ') : ''}
`.trim()

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 1536,
    messages: [{
      role: 'user',
      content: `You are a personal growth coach writing a monthly retrospective for a client. Be warm, specific, and insightful — not generic. Notice patterns and correlations across different life domains.

DATA FOR ${monthLabel.toUpperCase()}:
${dataContext}

Return a JSON object with these exact fields:
{
  "headline": "one punchy sentence capturing the month's essence (max 14 words)",
  "highlights": ["3 specific achievements or positive patterns from the data"],
  "growth_areas": ["2 areas where the data shows room for improvement"],
  "key_pattern": "one paragraph (3-4 sentences) about the most interesting pattern or correlation you notice across the data",
  "what_worked": ["2-3 behaviors or habits that clearly had positive impact"],
  "what_to_change": ["2 specific, actionable changes for next month"],
  "commitments_next_month": ["3 concrete commitments with measurable outcomes"],
  "score": <overall month score 1-10>,
  "score_reason": "one sentence explaining the score"
}

Return only valid JSON, no markdown.`,
    }],
  })

  const raw = (response.choices[0]?.message?.content ?? '').trim()
  let retro
  try {
    retro = JSON.parse(raw)
  } catch {
    retro = {
      headline: `Your ${monthLabel} in review`,
      highlights: [],
      growth_areas: [],
      key_pattern: raw,
      what_worked: [],
      what_to_change: [],
      commitments_next_month: [],
      score: 7,
      score_reason: '',
    }
  }

  // Cache it
  await supabase.from('monthly_retros').upsert({
    user_id: uid,
    month_start: monthStart,
    content: retro,
  }, { onConflict: 'user_id,month_start' })

  return NextResponse.json({ retro, cached: false, month: monthLabel })
}
