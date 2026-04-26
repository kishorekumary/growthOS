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
    .from('financial_profile')
    .select('monthly_income, total_savings, total_debt, financial_score')
    .eq('user_id', user.id)
    .maybeSingle()

  const context = profile
    ? `User's financial snapshot — income: $${profile.monthly_income ?? 'unknown'}/mo, savings: $${profile.total_savings ?? 0}, debt: $${profile.total_debt ?? 0}, health score: ${profile.financial_score ?? 'not calculated'}/100.`
    : 'Financial profile not yet set.'

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a friendly, practical personal finance coach. Give concise, actionable advice (2–4 sentences). ${context}`,
        },
        ...messages,
      ],
      max_tokens: 512,
      temperature: 0.75,
    })

    const reply = completion.choices[0]?.message?.content?.trim() ?? ''
    return NextResponse.json({ reply })
  } catch (err) {
    console.error('finance-coach error', err)
    return NextResponse.json({ reply: 'Sorry, I ran into an issue. Please try again.' })
  }
}
