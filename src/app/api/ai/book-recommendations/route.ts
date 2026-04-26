import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { openai } from '@/lib/claude'

export async function POST() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data: profile }, { data: prefs }] = await Promise.all([
    supabase.from('user_profiles')
      .select('age, occupation, primary_goals')
      .eq('id', user.id)
      .maybeSingle(),
    supabase.from('book_preferences')
      .select('genres, books_per_month')
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  const goals     = profile?.primary_goals?.join(', ') ?? 'personal growth'
  const occupation = profile?.occupation ?? 'professional'
  const age       = profile?.age ?? 'adult'
  const genres    = prefs?.genres?.join(', ') ?? 'non-fiction, self-help'

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are a personal book curator. Recommend real, published books tailored to the user. Return JSON only.',
        },
        {
          role: 'user',
          content: `Recommend exactly 6 books for this person:
- Age: ${age}
- Occupation: ${occupation}
- Goals: ${goals}
- Preferred genres: ${genres}

Return JSON: { "books": [ { "title": "", "author": "", "genre": "", "reason": "2 sentences on why this fits their goals", "key_lesson": "1 sentence on the main takeaway" } ] }
Only recommend real, well-known books. Match them closely to the user's stated goals.`,
        },
      ],
      max_tokens: 1200,
      temperature: 0.7,
    })

    const raw = completion.choices[0]?.message?.content ?? '{}'
    const parsed = JSON.parse(raw)
    return NextResponse.json({ books: parsed.books ?? [] })
  } catch (err) {
    console.error('book-recommendations error', err)
    return NextResponse.json({ books: [] })
  }
}
