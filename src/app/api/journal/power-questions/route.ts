import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { awardPoints } from '@/lib/awardPoints'
import { isPlausibleClientDate } from '@/lib/clientDate'
import { POWER_POINTS, POWER_TAG, POWER_TITLE, formatSession, type PowerKind, type QA } from '@/lib/powerQuestions'

// Saves a morning or evening power-questions session as a tagged journal
// entry. One per kind per day: a repeat updates the entry's text but pays
// no further points.
export async function POST(req: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { date, kind, qa } = await req.json().catch(() => ({})) as { date?: unknown; kind?: unknown; qa?: unknown }
  if (!isPlausibleClientDate(date)) {
    return NextResponse.json({ error: 'date required (YYYY-MM-DD)' }, { status: 400 })
  }
  if (kind !== 'morning' && kind !== 'evening') {
    return NextResponse.json({ error: 'kind must be morning or evening' }, { status: 400 })
  }
  const pairs: QA[] = Array.isArray(qa)
    ? qa.filter((x): x is QA => typeof x?.question === 'string' && typeof x?.answer === 'string').slice(0, 12)
    : []
  const content = formatSession(pairs).slice(0, 10000)
  if (!content) return NextResponse.json({ error: 'Answer at least one question' }, { status: 400 })

  const tag = POWER_TAG[kind as PowerKind]
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
    user_id: user.id, entry_date: date, title: POWER_TITLE[kind as PowerKind], content, tags: [tag],
  })
  if (insertErr) {
    console.error('POST /api/journal/power-questions: insert failed', insertErr)
    return NextResponse.json({ error: 'Could not save your answers' }, { status: 500 })
  }

  await supabase.from('user_rewards').upsert({ user_id: user.id }, { onConflict: 'user_id', ignoreDuplicates: true })
  const awarded = await awardPoints(supabase, user.id, POWER_POINTS, POWER_TITLE[kind as PowerKind])
  return NextResponse.json({ ok: true, points: awarded ? POWER_POINTS : 0 })
}
