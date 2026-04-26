import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { openai } from '@/lib/claude'

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { content, mood, entryId } = await req.json() as {
    content: string
    mood: number
    entryId: string
  }

  const [{ data: profile }, { data: assessment }] = await Promise.all([
    supabase.from('user_profiles').select('full_name, primary_goals').eq('id', user.id).single(),
    supabase
      .from('personality_assessments')
      .select('mbti_type')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const name = profile?.full_name?.split(' ')[0] ?? 'you'
  const mbti = assessment?.mbti_type ? ` (${assessment.mbti_type})` : ''

  const prompt = `You are a compassionate growth coach providing feedback on a personal journal entry.

User: ${name}${mbti}
Mood today: ${mood}/10
Journal entry: "${content}"

Write 3–4 sentences of thoughtful, warm feedback that:
1. Acknowledges their current emotional state
2. Highlights something positive or meaningful from their entry
3. Offers one gentle, actionable insight for growth
Keep it personal and encouraging, not generic.`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a warm, insightful personal growth coach. Be concise and genuine.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 200,
      temperature: 0.75,
    })

    const feedback = completion.choices[0]?.message?.content?.trim() ?? ''

    if (feedback && entryId) {
      await supabase
        .from('journal_entries')
        .update({ ai_feedback: feedback })
        .eq('id', entryId)
        .eq('user_id', user.id)
    }

    return NextResponse.json({ feedback })
  } catch {
    return NextResponse.json({ feedback: '' })
  }
}
