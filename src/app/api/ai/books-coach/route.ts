import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { openai } from '@/lib/claude'

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { messages } = await req.json() as {
    messages: { role: 'user' | 'assistant'; content: string }[]
  }

  const [{ data: profile }, { data: recent }] = await Promise.all([
    supabase.from('user_profiles')
      .select('primary_goals, occupation')
      .eq('id', user.id)
      .maybeSingle(),
    supabase.from('reading_log')
      .select('book_title, status')
      .order('updated_at', { ascending: false })
      .limit(5),
  ])

  const goals = profile?.primary_goals?.join(', ') ?? 'personal growth'
  const readingList = (recent ?? [])
    .map(b => `"${b.book_title}" (${b.status})`)
    .join(', ')

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an enthusiastic book coach who helps people get the most from their reading. Keep answers concise (2–4 sentences).
User goals: ${goals}.${readingList ? ` Recently reading: ${readingList}.` : ''}`,
        },
        ...messages,
      ],
      max_tokens: 512,
      temperature: 0.75,
    })

    const reply = completion.choices[0]?.message?.content?.trim() ?? ''
    return NextResponse.json({ reply })
  } catch (err) {
    console.error('books-coach error', err)
    return NextResponse.json({ reply: 'Sorry, I ran into an issue. Please try again.' })
  }
}
