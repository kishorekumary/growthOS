import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { openai } from '@/lib/claude'

export async function POST() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('financial_profile')
    .select('monthly_income, monthly_expenses')
    .eq('user_id', user.id)
    .maybeSingle()

  const income = Number(profile?.monthly_income ?? 0)
  if (income <= 0) {
    return NextResponse.json({ error: 'Monthly income not set' }, { status: 400 })
  }

  const existingExpenses = profile?.monthly_expenses
    ? Object.entries(profile.monthly_expenses as Record<string, number>)
        .map(([k, v]) => `${k}: $${v}`)
        .join(', ')
    : 'none on file'

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are a personal finance expert. Create practical 50/30/20 budgets. Respond with JSON only.',
        },
        {
          role: 'user',
          content: `Create a 50/30/20 budget for monthly income of $${income}.
Known recurring expenses: ${existingExpenses}.

Return JSON with exactly this structure:
{
  "needs":   { "label": "Needs (50%)",   "percentage": 50, "amount": ${Math.round(income * 0.5)}, "items": [{"name": "...", "amount": 0}] },
  "wants":   { "label": "Wants (30%)",   "percentage": 30, "amount": ${Math.round(income * 0.3)}, "items": [{"name": "...", "amount": 0}] },
  "savings": { "label": "Savings (20%)", "percentage": 20, "amount": ${Math.round(income * 0.2)}, "items": [{"name": "...", "amount": 0}] }
}
Include 4-6 realistic line items per category. Amounts must sum to the category total.`,
        },
      ],
      max_tokens: 800,
      temperature: 0.5,
    })

    const raw = completion.choices[0]?.message?.content ?? '{}'
    const budget = JSON.parse(raw)

    await supabase.from('budgets').insert({ user_id: user.id, budget })

    return NextResponse.json({ budget })
  } catch (err) {
    console.error('finance-budget error', err)
    return NextResponse.json({ error: 'Failed to generate budget' }, { status: 500 })
  }
}
