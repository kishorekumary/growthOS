import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { openai } from '@/lib/claude'
import { MBTI_TYPES } from '@/lib/mbti'

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { mbtiType } = await req.json() as { mbtiType: string }
  const typeData = MBTI_TYPES[mbtiType]
  if (!typeData) return NextResponse.json({ error: 'Invalid type' }, { status: 400 })

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, occupation, primary_goals')
    .eq('id', user.id)
    .single()

  const name = profile?.full_name?.split(' ')[0] ?? 'you'

  const prompt = `The user ${name} just completed a personality assessment and got ${mbtiType} — ${typeData.name}.
${profile?.occupation ? `They work as ${profile.occupation}.` : ''}
${profile?.primary_goals?.length ? `Their growth goals: ${profile.primary_goals.join(', ')}.` : ''}

Write a JSON response with exactly these fields:
- "description": two engaging paragraphs (no line breaks within each) describing the ${mbtiType} personality in a warm, insightful way
- "strengths": array of exactly 5 short strength phrases specific to ${mbtiType}
- "growth": array of exactly 5 short growth area phrases specific to ${mbtiType}
- "habits": array of exactly 3 specific daily habit recommendations tailored to ${mbtiType} personality

Return ONLY valid JSON, no markdown.`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an expert in MBTI personality psychology. Always respond with valid JSON only.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 700,
      temperature: 0.7,
      response_format: { type: 'json_object' },
    })

    const raw = completion.choices[0]?.message?.content ?? '{}'
    const parsed = JSON.parse(raw)

    return NextResponse.json({
      description: parsed.description ?? '',
      strengths: parsed.strengths ?? typeData.strengths,
      growth: parsed.growth ?? typeData.growth,
      habits: parsed.habits ?? [],
    })
  } catch {
    return NextResponse.json({
      description: '',
      strengths: typeData.strengths,
      growth: typeData.growth,
      habits: [],
    })
  }
}
