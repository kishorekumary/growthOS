import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { openai } from '@/lib/claude'
import { format } from 'date-fns'

export async function POST() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const challengeMonth = format(new Date(), 'yyyy-MM-01')

  // Return existing challenge if one exists this month
  const { data: existing } = await supabase
    .from('book_challenges')
    .select('*')
    .eq('user_id', user.id)
    .eq('challenge_month', challengeMonth)
    .maybeSingle()

  if (existing) return NextResponse.json({ challenge: existing })

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('primary_goals, occupation')
    .eq('id', user.id)
    .maybeSingle()

  const goals = profile?.primary_goals?.join(', ') ?? 'personal growth'
  const month = format(new Date(), 'MMMM yyyy')

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are a book club curator. Pick one meaningful book per month. Return JSON only.',
        },
        {
          role: 'user',
          content: `Pick the perfect monthly reading challenge book for ${month}.
User goals: ${goals}
Occupation: ${profile?.occupation ?? 'professional'}

Return JSON: {
  "title": "",
  "author": "",
  "genre": "",
  "total_chapters": 12,
  "ai_note": "1 enthusiastic sentence about why this book is perfect for this month"
}
Pick a real, well-known book that is widely available.`,
        },
      ],
      max_tokens: 300,
      temperature: 0.7,
    })

    const raw = completion.choices[0]?.message?.content ?? '{}'
    const picked = JSON.parse(raw)

    const { data: challenge } = await supabase
      .from('book_challenges')
      .insert({
        user_id: user.id,
        challenge_month: challengeMonth,
        book_title: picked.title,
        author: picked.author,
        genre: picked.genre,
        total_chapters: picked.total_chapters ?? 10,
        ai_note: picked.ai_note,
      })
      .select()
      .single()

    return NextResponse.json({ challenge })
  } catch (err) {
    console.error('book-challenge error', err)
    return NextResponse.json({ challenge: null })
  }
}
