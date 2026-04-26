import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { openai } from '@/lib/claude'
import { MBTI_TYPES } from '@/lib/mbti'

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { messages, mbtiType } = await req.json() as {
    messages: { role: 'user' | 'assistant'; content: string }[]
    mbtiType: string | null
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, primary_goals')
    .eq('id', user.id)
    .single()

  const typeData = mbtiType ? MBTI_TYPES[mbtiType] : null
  const name = profile?.full_name?.split(' ')[0] ?? 'there'

  const systemPrompt = `You are a compassionate, insightful personal growth coach inside the GrowthOS app.
You are chatting with ${name}${mbtiType ? `, who has an ${mbtiType} (${typeData?.name ?? ''}) personality type` : ''}.
${typeData ? `Key traits: ${typeData.tagline}. Their growth areas include: ${typeData.growth.slice(0, 3).join(', ')}.` : ''}
${profile?.primary_goals?.length ? `Their growth goals: ${profile.primary_goals.join(', ')}.` : ''}

Be warm, specific, and action-oriented. Keep responses to 2-4 sentences unless a longer answer is clearly needed.
Tailor advice to their personality type when relevant.`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      max_tokens: 300,
      temperature: 0.75,
    })

    const reply = completion.choices[0]?.message?.content?.trim() ?? ''

    await supabase.from('ai_conversations').insert({
      section: 'personality',
      session_id: crypto.randomUUID(),
      role: 'assistant',
      content: reply,
      tokens_used: completion.usage?.total_tokens ?? null,
    })

    return NextResponse.json({ reply })
  } catch {
    return NextResponse.json({ reply: 'I\'m having trouble responding right now. Please try again.' })
  }
}
