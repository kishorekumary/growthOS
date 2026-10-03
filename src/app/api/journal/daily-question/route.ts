import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { awardPoints } from '@/lib/awardPoints'
import { isPlausibleClientDate } from '@/lib/clientDate'
import { DAILY_QUESTION_POINTS, DAILY_QUESTION_TAG } from '@/lib/dailyQuestion'

// Saves the answer to the day's question as a regular journal entry (title =
// the question, tagged so the dashboard can tell it's been answered) and
// pays a small bonus — once per day.
export async function POST(req: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { date, question, answer } = await req.json().catch(() => ({})) as {
    date?: unknown; question?: unknown; answer?: unknown
  }
  if (!isPlausibleClientDate(date)) {
    return NextResponse.json({ error: 'date required (YYYY-MM-DD)' }, { status: 400 })
  }
  if (typeof question !== 'string' || !question.trim() || typeof answer !== 'string' || !answer.trim()) {
    return NextResponse.json({ error: 'question and answer required' }, { status: 400 })
  }

  const { data: existing } = await supabase
    .from('journal_entries').select('id')
    .eq('user_id', user.id).eq('entry_date', date).contains('tags', [DAILY_QUESTION_TAG])
    .limit(1)
  if (existing?.length) return NextResponse.json({ ok: true, alreadyAnswered: true, points: 0 })

  const { error: insertErr } = await supabase.from('journal_entries').insert({
    user_id:    user.id,
    entry_date: date,
    title:      question.trim().slice(0, 300),
    content:    answer.trim().slice(0, 5000),
    tags:       [DAILY_QUESTION_TAG],
  })
  if (insertErr) {
    console.error('POST /api/journal/daily-question: insert failed', insertErr)
    return NextResponse.json({ error: 'Could not save your answer' }, { status: 500 })
  }

  await supabase.from('user_rewards').upsert({ user_id: user.id }, { onConflict: 'user_id', ignoreDuplicates: true })
  const awarded = await awardPoints(supabase, user.id, DAILY_QUESTION_POINTS, 'Daily question')

  return NextResponse.json({ ok: true, alreadyAnswered: false, points: awarded ? DAILY_QUESTION_POINTS : 0 })
}
