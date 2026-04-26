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

  const { data: profile } = await supabase
    .from('fitness_profile')
    .select('fitness_level, primary_goal, current_weight, target_weight, activity_days')
    .eq('user_id', user.id)
    .maybeSingle()

  const context = profile
    ? `User fitness profile — level: ${profile.fitness_level ?? 'intermediate'}, goal: ${profile.primary_goal ?? 'general fitness'}, trains ${profile.activity_days ?? 3} days/week.`
    : 'User fitness profile not set.'

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a knowledgeable, encouraging fitness coach. Keep responses concise (2–4 sentences). ${context}`,
        },
        ...messages,
      ],
      max_tokens: 512,
      temperature: 0.75,
    })

    const reply = completion.choices[0]?.message?.content?.trim() ?? ''
    return NextResponse.json({ reply })
  } catch (err) {
    console.error('fitness-coach error', err)
    return NextResponse.json({ reply: 'Sorry, I ran into an issue. Please try again.' })
  }
}
