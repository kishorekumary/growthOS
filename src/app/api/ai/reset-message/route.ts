import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { openai } from '@/lib/claude'

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { context } = body as { context?: string }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, primary_goals, occupation')
    .eq('id', user.id)
    .maybeSingle()

  const firstName = profile?.full_name?.split(' ')[0] ?? 'friend'
  const goals = profile?.primary_goals?.join(', ') ?? 'personal growth'

  const lines = [
    `Name: ${firstName}`,
    `Goals: ${goals}`,
    profile?.occupation ? `Occupation: ${profile.occupation}` : null,
    context ? `What they're feeling: ${context}` : `They said they're not feeling good right now.`,
  ].filter(Boolean).join('\n')

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a warm, grounded coach helping someone who is having a hard moment. Write 3-4 sentences that are genuine and calming. Be specific to any context they share. No platitudes, no bullet points, no generic advice. Just honest, human words that help them breathe and reset.`,
        },
        { role: 'user', content: lines },
      ],
      max_tokens: 220,
      temperature: 0.85,
    })

    const message = completion.choices[0]?.message?.content?.trim()
      ?? `Take a breath, ${firstName}. You're doing better than you think. Hard moments always pass.`

    return NextResponse.json({ message })
  } catch {
    return NextResponse.json({
      message: `Take a breath, ${firstName}. You're doing better than you think. This feeling is temporary — it will pass.`,
    })
  }
}
