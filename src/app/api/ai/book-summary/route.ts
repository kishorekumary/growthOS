import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { openai } from '@/lib/claude'

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { bookId, title, author } = await req.json() as {
    bookId: string
    title: string
    author: string
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are a book expert. Summarize books accurately and extract actionable lessons. Return JSON only.',
        },
        {
          role: 'user',
          content: `Summarize "${title}" by ${author}.

Return JSON: {
  "summary": "3-4 sentence overview of the book",
  "lessons": ["lesson 1", "lesson 2", "lesson 3", "lesson 4", "lesson 5"]
}
Be specific and insightful. Lessons should be actionable takeaways.`,
        },
      ],
      max_tokens: 500,
      temperature: 0.5,
    })

    const raw = completion.choices[0]?.message?.content ?? '{}'
    const parsed = JSON.parse(raw)

    // Persist to ai_summary as JSON string
    if (bookId) {
      await supabase.from('reading_log')
        .update({
          ai_summary: JSON.stringify({ summary: parsed.summary, lessons: parsed.lessons }),
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookId)
        .eq('user_id', user.id)
    }

    return NextResponse.json({ summary: parsed.summary ?? '', lessons: parsed.lessons ?? [] })
  } catch (err) {
    console.error('book-summary error', err)
    return NextResponse.json({ summary: '', lessons: [] })
  }
}
