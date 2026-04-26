import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { openai } from '@/lib/claude'

export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [{ data: profile }, { data: fitness }, { data: finance }] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('full_name, primary_goals, occupation, country')
      .eq('id', user.id)
      .single(),
    supabase
      .from('fitness_profile')
      .select('primary_goal, fitness_level')
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('financial_profile')
      .select('financial_score')
      .eq('user_id', user.id)
      .single(),
  ])

  const name = profile?.full_name?.split(' ')[0] ?? 'there'
  const goals = profile?.primary_goals?.join(', ') ?? 'personal growth'
  const hour = new Date().getHours()
  const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'

  const systemPrompt = `You are a warm, encouraging personal growth coach for GrowthOS app.
Write a 2-sentence personalized daily ${timeOfDay} message for ${name}.
User context: ${profile?.occupation ? `works as ${profile.occupation}` : 'professional'},
from ${profile?.country ?? 'the world'}, focused on: ${goals}.
${fitness?.primary_goal ? `Fitness goal: ${fitness.primary_goal}.` : ''}
${finance?.financial_score ? `Financial health score: ${finance.financial_score}/100.` : ''}
Be specific, uplifting, and action-oriented. No hashtags. No emojis. Plain text only.`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Write my daily greeting.' },
      ],
      max_tokens: 120,
      temperature: 0.85,
    })

    const message = completion.choices[0]?.message?.content?.trim() ??
      `Welcome back, ${name}! Today is a great day to make progress on your goals.`

    return NextResponse.json({ message })
  } catch {
    return NextResponse.json({
      message: `Welcome back, ${name}! Small consistent steps lead to big changes — keep going.`,
    })
  }
}
