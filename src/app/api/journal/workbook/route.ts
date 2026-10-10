import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { awardPoints } from '@/lib/awardPoints'
import { isPlausibleClientDate } from '@/lib/clientDate'
import { formatSession, type QA } from '@/lib/powerQuestions'
import { WORKBOOK_POINTS, WORKBOOK_TAG, exerciseTag, findExercise } from '@/lib/workbook'

// Saves a workbook exercise as a tagged journal entry. One per exercise per
// day: a repeat that day updates the entry's text but pays no further points.
export async function POST(req: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { date, slug, qa } = await req.json().catch(() => ({})) as { date?: unknown; slug?: unknown; qa?: unknown }
  if (!isPlausibleClientDate(date)) {
    return NextResponse.json({ error: 'date required (YYYY-MM-DD)' }, { status: 400 })
  }
  const exercise = typeof slug === 'string' ? findExercise(slug) : undefined
  if (!exercise) return NextResponse.json({ error: 'Unknown exercise' }, { status: 400 })

  const pairs: QA[] = Array.isArray(qa)
    ? qa.filter((x): x is QA => typeof x?.question === 'string' && typeof x?.answer === 'string').slice(0, 20)
    : []
  const content = formatSession(pairs).slice(0, 20000)
  if (!content) return NextResponse.json({ error: 'Answer at least one question' }, { status: 400 })

  const tag = exerciseTag(exercise.slug)
  const { data: existing } = await supabase
    .from('journal_entries').select('id')
    .eq('user_id', user.id).eq('entry_date', date).contains('tags', [tag])
    .limit(1)

  if (existing?.length) {
    await supabase.from('journal_entries')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('id', existing[0].id)
    return NextResponse.json({ ok: true, points: 0 })
  }

  const { error: insertErr } = await supabase.from('journal_entries').insert({
    user_id: user.id, entry_date: date, title: exercise.title, content, tags: [WORKBOOK_TAG, tag],
  })
  if (insertErr) {
    console.error('POST /api/journal/workbook: insert failed', insertErr)
    return NextResponse.json({ error: 'Could not save your answers' }, { status: 500 })
  }

  await supabase.from('user_rewards').upsert({ user_id: user.id }, { onConflict: 'user_id', ignoreDuplicates: true })
  const awarded = await awardPoints(supabase, user.id, WORKBOOK_POINTS, exercise.title)
  return NextResponse.json({ ok: true, points: awarded ? WORKBOOK_POINTS : 0 })
}
