import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { notePreview } from '@/lib/notes'

export type SearchResultItem = {
  id: string
  type: 'task' | 'book' | 'goal' | 'habit' | 'journal' | 'note' | 'workout' | 'nutrition' | 'finance' | 'challenge' | 'section'
  title: string
  subtitle?: string
  href: string
  meta?: string
}

// Quick-nav sections matched by keyword
const SECTION_MAP: { keywords: string[]; title: string; subtitle: string; href: string }[] = [
  { keywords: ['log', 'food', 'meal', 'eat', 'nutrition', 'calori', 'water', 'drink', 'macro', 'protein', 'carb', 'fat'], title: 'Food Log', subtitle: 'Nutrition tracker', href: '/fitness?tab=Nutrition' },
  { keywords: ['log', 'workout', 'exercise', 'gym', 'fitness', 'train', 'run', 'lift', 'cardio'], title: 'Workout Log', subtitle: 'Log a workout', href: '/fitness?tab=Log+Workout' },
  { keywords: ['book', 'read', 'reading', 'library', 'list', 'author'], title: 'Reading List', subtitle: 'Your books', href: '/books?tab=My+List' },
  { keywords: ['task', 'todo', 'to-do', 'checklist', 'reminder', 'plan', 'planner', 'daily', 'weekly', 'monthly'], title: 'Planner', subtitle: 'Daily, weekly & monthly lists', href: '/planner' },
  { keywords: ['goal', 'target', 'objective', 'milestone'], title: 'Goals', subtitle: 'Your goals', href: '/goals' },
  { keywords: ['habit', 'routine', 'streak', 'daily'], title: 'Habits', subtitle: 'Habit tracker', href: '/personality/habits' },
  { keywords: ['journal', 'diary', 'reflect', 'entry', 'mood'], title: 'Journal', subtitle: 'Daily reflections', href: '/personality/journal' },
  { keywords: ['note', 'notepad', 'jot', 'shopping', 'list', 'pin'], title: 'Notes', subtitle: 'Lists & things to remember', href: '/notes' },
  { keywords: ['finance', 'money', 'budget', 'expense', 'income', 'transaction', 'spend', 'saving'], title: 'Finance', subtitle: 'Budget & transactions', href: '/finance?tab=Tracker' },
  { keywords: ['challenge', 'ninety', '90-day'], title: 'Challenges', subtitle: '90-day challenges', href: '/challenges' },
  { keywords: ['progress', 'fitness', 'stats', 'weight', 'body'], title: 'Fitness Progress', subtitle: 'Charts & stats', href: '/fitness?tab=Progress' },
]

function getSectionMatches(q: string): SearchResultItem[] {
  const lower = q.toLowerCase()
  const seen = new Set<string>()
  const matches: SearchResultItem[] = []

  for (const sec of SECTION_MAP) {
    if (seen.has(sec.href)) continue
    if (sec.keywords.some(kw => lower.includes(kw))) {
      seen.add(sec.href)
      matches.push({
        id: `section-${sec.href}`,
        type: 'section',
        title: sec.title,
        subtitle: sec.subtitle,
        href: sec.href,
      })
    }
  }
  return matches
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json({ results: [] })

  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const uid = user.id
  const p = `%${q}%`

  const [todos, books, goals, habits, journals, notes, workouts, nutrition, finance, challenges] = await Promise.all([
    supabase.from('planner_items')
      .select('id, title, notes, is_completed, period_type, period_start, repeats')
      .eq('user_id', uid)
      .is('ended_at', null)
      .or(`title.ilike.${p},notes.ilike.${p}`)
      .limit(5),

    supabase.from('reading_log')
      .select('id, book_title, author, status, genre')
      .or(`user_id.eq.${uid},is_global.eq.true`)
      .or(`book_title.ilike.${p},author.ilike.${p},genre.ilike.${p}`)
      .limit(5),

    supabase.from('user_goals')
      .select('id, title, category, is_completed, target_date')
      .eq('user_id', uid)
      .ilike('title', p)
      .limit(5),

    supabase.from('personality_habits')
      .select('id, habit_name, description, streak_count')
      .eq('user_id', uid)
      .or(`habit_name.ilike.${p},description.ilike.${p}`)
      .limit(5),

    supabase.from('journal_entries')
      .select('id, content, entry_date, mood')
      .eq('user_id', uid)
      .ilike('content', p)
      .order('entry_date', { ascending: false })
      .limit(5),

    supabase.from('notes')
      .select('id, title, content, is_pinned')
      .eq('user_id', uid)
      .or(`title.ilike.${p},content.ilike.${p}`)
      .order('updated_at', { ascending: false })
      .limit(5),

    supabase.from('workout_logs')
      .select('id, workout_type, log_date, duration_mins, notes')
      .eq('user_id', uid)
      .or(`workout_type.ilike.${p},notes.ilike.${p}`)
      .limit(5),

    supabase.from('nutrition_logs')
      .select('id, food_name, meal_type, log_date, calories')
      .eq('user_id', uid)
      .ilike('food_name', p)
      .order('log_date', { ascending: false })
      .limit(5),

    supabase.from('transactions')
      .select('id, description, category, amount, type, txn_date')
      .eq('user_id', uid)
      .or(`description.ilike.${p},category.ilike.${p}`)
      .limit(5),

    supabase.from('ninety_day_challenges')
      .select('id, title, category, description, start_date')
      .eq('user_id', uid)
      .or(`title.ilike.${p},description.ilike.${p}`)
      .limit(5),
  ])

  // Section quick-nav comes first
  const results: SearchResultItem[] = [...getSectionMatches(q)]

  todos.data?.forEach(t => results.push({
    id: t.id,
    type: 'task',
    title: t.title,
    subtitle: t.notes ?? undefined,
    href: `/planner?highlight=${t.id}`,
    meta: t.is_completed ? 'Done' : t.repeats
      ? ({ day: 'Daily', week: 'Weekly', month: 'Monthly' } as const)[t.period_type as 'day' | 'week' | 'month']
      : `${t.period_type} · ${t.period_start}`,
  }))

  books.data?.forEach(b => results.push({
    id: b.id,
    type: 'book',
    title: b.book_title,
    subtitle: b.author ?? undefined,
    href: `/books?tab=My+List&highlight=${b.id}`,
    meta: b.status?.replace('_', ' '),
  }))

  goals.data?.forEach(g => results.push({
    id: g.id,
    type: 'goal',
    title: g.title,
    subtitle: g.category,
    href: '/goals',
    meta: g.is_completed ? 'Completed' : (g.target_date ?? undefined),
  }))

  habits.data?.forEach(h => results.push({
    id: h.id,
    type: 'habit',
    title: h.habit_name,
    subtitle: h.description ?? undefined,
    href: '/personality/habits',
    meta: h.streak_count ? `${h.streak_count}d streak` : undefined,
  }))

  journals.data?.forEach(j => results.push({
    id: j.id,
    type: 'journal',
    title: `Journal — ${j.entry_date}`,
    subtitle: j.content?.slice(0, 90).trim(),
    href: '/personality/journal',
    meta: j.mood ? `Mood ${j.mood}/10` : undefined,
  }))

  notes.data?.forEach(n => results.push({
    id: n.id,
    type: 'note',
    title: n.title || notePreview(n.content, 40) || 'Untitled note',
    subtitle: n.title ? notePreview(n.content) : undefined,
    href: `/notes?id=${n.id}`,
    meta: n.is_pinned ? 'Pinned' : undefined,
  }))

  workouts.data?.forEach(w => results.push({
    id: w.id,
    type: 'workout',
    title: `${capitalize(w.workout_type)} workout`,
    subtitle: w.notes ?? undefined,
    href: '/fitness?tab=Log+Workout',
    meta: w.log_date,
  }))

  nutrition.data?.forEach(n => results.push({
    id: n.id,
    type: 'nutrition',
    title: n.food_name,
    subtitle: n.meal_type ? capitalize(n.meal_type) : undefined,
    href: '/fitness?tab=Nutrition',
    meta: n.calories ? `${n.calories} kcal` : n.log_date,
  }))

  finance.data?.forEach(f => results.push({
    id: f.id,
    type: 'finance',
    title: f.description || capitalize(f.category),
    subtitle: `${capitalize(f.type)} · ${capitalize(f.category)}`,
    href: '/finance?tab=Tracker',
    meta: f.amount != null ? `$${f.amount}` : undefined,
  }))

  challenges.data?.forEach(c => results.push({
    id: c.id,
    type: 'challenge',
    title: c.title,
    subtitle: c.description ?? undefined,
    href: '/challenges',
    meta: c.category ? capitalize(c.category) : undefined,
  }))

  return NextResponse.json({ results })
}

function capitalize(s: string | null | undefined) {
  if (!s) return ''
  return s.charAt(0).toUpperCase() + s.slice(1)
}
