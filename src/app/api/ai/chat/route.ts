import { createSupabaseServerClient } from '@/lib/supabase-server'
import { openai } from '@/lib/openai'

type Section = 'personality' | 'fitness' | 'finance' | 'books'

const PERSONA_NAMES: Record<Section, string> = {
  personality: 'Sage',
  fitness: 'Coach Alex',
  finance: 'Advisor Morgan',
  books: 'Librarian Quinn',
}

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const {
    section,
    session_id,
    message,
  } = (await req.json()) as {
    section: Section
    session_id: string
    message: string
  }

  if (!section || !message || !PERSONA_NAMES[section]) {
    return new Response('Bad Request', { status: 400 })
  }

  const sessionId = session_id ?? crypto.randomUUID()

  const [
    { data: profile },
    { data: financial },
    { data: fitness },
    { data: personality },
  ] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('full_name, age, occupation, primary_goals, currency')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('financial_profile')
      .select('monthly_income, financial_score')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('fitness_profile')
      .select('fitness_level, primary_goal')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('personality_assessments')
      .select('mbti_type')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const name = profile?.full_name?.split(' ')[0] ?? 'there'
  const personaName = PERSONA_NAMES[section]
  const currency = profile?.currency ?? 'USD'
  const income = financial?.monthly_income ?? 0
  const score = financial?.financial_score ?? 'N/A'
  const mbti = personality?.mbti_type ?? 'unknown'
  const fitnessLevel = fitness?.fitness_level ?? 'intermediate'
  const fitnessGoal = fitness?.primary_goal ?? 'general fitness'
  const goals = (profile?.primary_goals ?? []).join(', ') || 'growth and self-improvement'
  const age = profile?.age ?? 'unknown'
  const occupation = profile?.occupation ?? 'unknown'

  const systemPrompt = `You are ${personaName}, a personal ${section} coach for ${name}.

About ${name}:
- Age: ${age}, Occupation: ${occupation}
- Monthly income: ${income} ${currency}
- Personality type: ${mbti}
- Fitness level: ${fitnessLevel}, Fitness goal: ${fitnessGoal}
- Primary life goals: ${goals}
- Financial health score: ${score}/100

Guidelines:
- Always give advice specific to their income level and situation
- Be encouraging but honest
- Keep responses under 200 words unless asked for a full plan
- Reference their data when relevant
- Never give medical or licensed financial advice`

  // Save user message
  await supabase.from('ai_conversations').insert({
    user_id: user.id,
    section,
    session_id: sessionId,
    role: 'user',
    content: message,
    tokens_used: null,
  })

  const stream = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 1024,
    stream: true,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message },
    ],
  })

  const encoder = new TextEncoder()
  let fullText = ''

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? ''
          if (text) {
            fullText += text
            controller.enqueue(encoder.encode(text))
          }
        }
        await supabase.from('ai_conversations').insert({
          user_id: user.id,
          section,
          session_id: sessionId,
          role: 'assistant',
          content: fullText,
          tokens_used: null,
        })
        controller.close()
      } catch (err) {
        controller.error(err)
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
