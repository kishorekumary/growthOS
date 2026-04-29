import { NextResponse } from 'next/server'
import { openai } from '@/lib/openai'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'

export async function GET() {
  const { data: { user } } = await createSupabaseServerClient().auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createSupabaseAdminClient()
  const since = new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0]

  const [logsRes, statsRes, weightRes] = await Promise.all([
    admin.from('nutrition_logs')
      .select('log_date,calories,protein_g,carbs_g,fiber_g,fat_g,food_name,meal_type')
      .eq('user_id', user.id)
      .gte('log_date', since)
      .order('log_date', { ascending: false }),
    admin.from('body_stats').select('*').eq('user_id', user.id).single(),
    admin.from('weight_logs')
      .select('log_date,weight_kg')
      .eq('user_id', user.id)
      .order('log_date', { ascending: false })
      .limit(10),
  ])

  const logs = logsRes.data ?? []
  const stats = statsRes.data
  const weights = weightRes.data ?? []

  if (logs.length === 0) {
    return NextResponse.json({
      recommendations: [{
        title: 'Start logging meals',
        description: 'Log at least 3 days of meals so the AI can learn your eating patterns and give personalised recommendations.',
        priority: 'high',
      }],
    })
  }

  // Compute per-day averages
  type DayMap = Record<string, { calories: number; protein_g: number; carbs_g: number; fiber_g: number; fat_g: number; count: number }>
  const byDay = logs.reduce<DayMap>((acc, l) => {
    const d = l.log_date
    if (!acc[d]) acc[d] = { calories: 0, protein_g: 0, carbs_g: 0, fiber_g: 0, fat_g: 0, count: 0 }
    acc[d].calories  += l.calories
    acc[d].protein_g += Number(l.protein_g)
    acc[d].carbs_g   += Number(l.carbs_g)
    acc[d].fiber_g   += Number(l.fiber_g)
    acc[d].fat_g     += Number(l.fat_g)
    acc[d].count++
    return acc
  }, {})

  const days = Object.values(byDay)
  const avg = {
    calories:  Math.round(days.reduce((s, d) => s + d.calories,  0) / days.length),
    protein_g: +(days.reduce((s, d) => s + d.protein_g, 0) / days.length).toFixed(1),
    carbs_g:   +(days.reduce((s, d) => s + d.carbs_g,   0) / days.length).toFixed(1),
    fiber_g:   +(days.reduce((s, d) => s + d.fiber_g,   0) / days.length).toFixed(1),
    fat_g:     +(days.reduce((s, d) => s + d.fat_g,     0) / days.length).toFixed(1),
  }

  const topFoods = Array.from(new Set(logs.map(l => l.food_name))).slice(0, 12)
  const latestWeight = weights[0]?.weight_kg
  const weightTrend  = weights.length >= 2
    ? (Number(weights[0].weight_kg) - Number(weights[weights.length - 1].weight_kg)).toFixed(1)
    : null

  const prompt = `You are a registered dietitian AI. Analyse this user's nutrition data and give personalised recommendations.

BODY STATS:
- Height: ${stats?.height_cm ?? 'unknown'} cm
- Age: ${stats?.age ?? 'unknown'}
- Current weight: ${latestWeight ?? 'unknown'} kg
- Target weight: ${stats?.target_weight_kg ?? 'not set'} kg
- Weight change (last ${weights.length} entries): ${weightTrend ? `${weightTrend} kg` : 'insufficient data'}

AVERAGE DAILY NUTRITION (last ${days.length} days logged):
- Calories: ${avg.calories} kcal
- Protein: ${avg.protein_g}g
- Carbs: ${avg.carbs_g}g
- Fiber: ${avg.fiber_g}g
- Fat: ${avg.fat_g}g

FREQUENTLY EATEN FOODS: ${topFoods.join(', ')}

Return ONLY a valid JSON object — no markdown, no explanation:
{
  "summary": "2-sentence summary of their current eating pattern",
  "recommendations": [
    {
      "title": "short title",
      "description": "2-3 sentence actionable advice",
      "priority": "high" | "medium" | "low"
    }
  ]
}

Give 4-5 specific, personalised recommendations. Reference their actual data.`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const text  = response.choices[0]?.message?.content ?? ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return NextResponse.json({ error: 'Could not parse AI response' }, { status: 500 })

  try {
    return NextResponse.json(JSON.parse(match[0]))
  } catch {
    return NextResponse.json({ error: 'Invalid AI response' }, { status: 500 })
  }
}
