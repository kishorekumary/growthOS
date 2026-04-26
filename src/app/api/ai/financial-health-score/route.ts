import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { openai } from '@/lib/claude'

interface Goal {
  target_amount: number
  current_amount: number
  is_completed: boolean
}

function calcScore(
  monthlyIncome: number,
  monthlySavingsTxn: number,
  totalSavings: number,
  totalDebt: number,
  goals: Goal[]
): number {
  // Savings rate: 20%+ = full 30 pts
  const savingsRate = monthlyIncome > 0 ? monthlySavingsTxn / monthlyIncome : 0
  const savingsScore = Math.min(30, Math.round(savingsRate * 150))

  // Debt-to-annual-income ratio: 0 = 30 pts, 100%+ = 0 pts
  const annualIncome = monthlyIncome * 12
  const debtRatio = annualIncome > 0 ? totalDebt / annualIncome : 0
  const debtScore = Math.max(0, Math.round(30 * (1 - Math.min(1, debtRatio))))

  // Emergency fund: 6+ months of income = 20 pts
  const emergencyMonths = monthlyIncome > 0 ? totalSavings / monthlyIncome : 0
  const emergencyScore = Math.min(20, Math.round((emergencyMonths / 6) * 20))

  // Goal progress: average completion of active goals
  const activeGoals = goals.filter(g => !g.is_completed)
  const avgProgress = activeGoals.length > 0
    ? activeGoals.reduce((s, g) => s + Math.min(1, g.current_amount / Math.max(1, g.target_amount)), 0) / activeGoals.length
    : 0.5
  const goalScore = Math.round(avgProgress * 20)

  return savingsScore + debtScore + emergencyScore + goalScore
}

export async function POST() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]

  const [{ data: profile }, { data: goals }, { data: savingsTxns }] = await Promise.all([
    supabase.from('financial_profile')
      .select('monthly_income, total_savings, total_debt')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase.from('finance_goals')
      .select('target_amount, current_amount, is_completed'),
    supabase.from('transactions')
      .select('amount')
      .eq('type', 'savings')
      .gte('txn_date', monthStart),
  ])

  const monthlyIncome    = Number(profile?.monthly_income ?? 0)
  const totalSavings     = Number(profile?.total_savings ?? 0)
  const totalDebt        = Number(profile?.total_debt ?? 0)
  const monthlySavings   = (savingsTxns ?? []).reduce((s, t) => s + Number(t.amount), 0)

  const score = calcScore(monthlyIncome, monthlySavings, totalSavings, totalDebt, goals ?? [])

  // Persist score
  await supabase.from('financial_profile')
    .update({ financial_score: score, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)

  const scoreLabel = score < 40 ? 'needs attention' : score < 70 ? 'making progress' : 'in great shape'

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are a financial wellness coach. Respond with JSON only.',
        },
        {
          role: 'user',
          content: `Financial snapshot:
- Score: ${score}/100 (${scoreLabel})
- Monthly income: $${monthlyIncome}
- Monthly savings: $${monthlySavings}
- Total savings: $${totalSavings}
- Total debt: $${totalDebt}
- Active goals: ${(goals ?? []).filter(g => !g.is_completed).length}

Return JSON: { "explanation": "2 sentences about this score", "tips": ["tip1", "tip2", "tip3"] }`,
        },
      ],
      max_tokens: 300,
      temperature: 0.7,
    })

    const raw = completion.choices[0]?.message?.content ?? '{}'
    const parsed = JSON.parse(raw)

    return NextResponse.json({
      score,
      explanation: parsed.explanation ?? '',
      tips: parsed.tips ?? [],
    })
  } catch {
    return NextResponse.json({ score, explanation: '', tips: [] })
  }
}
