import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { openai } from '@/lib/claude'

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { topic, bookTitle } = await req.json() as { topic: string; bookTitle: string }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are a concise knowledge assistant. Explain concepts directly and practically. Never mention book titles, authors, or source material. Return JSON only.',
        },
        {
          role: 'user',
          content: `Explain the concept "${topic}" directly and practically. Do NOT mention any book title or author.

Return JSON:
{
  "summary": "2-3 sentences explaining what this concept means and why it matters — written as standalone insight, no source reference",
  "keyPoints": ["actionable point 1", "actionable point 2", "actionable point 3"]
}`,
        },
      ],
      max_tokens: 350,
      temperature: 0.5,
    })

    const raw = completion.choices[0]?.message?.content ?? '{}'
    const parsed = JSON.parse(raw)
    return NextResponse.json({ summary: parsed.summary ?? '', keyPoints: parsed.keyPoints ?? [] })
  } catch (err) {
    console.error('mindmap-node-summary error', err)
    return NextResponse.json({ summary: '', keyPoints: [] })
  }
}
