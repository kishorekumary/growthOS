import { NextRequest, NextResponse } from 'next/server'
import { openai } from '@/lib/claude'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const { data: { user } } = await createSupabaseServerClient().auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { logs, goals, waterMl } = await req.json()
  if (!logs?.length) return NextResponse.json({ error: 'No logs provided' }, { status: 400 })

  // Build a readable meal timeline
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const timeline = logs.map((l: any) => {
    const time = l.logged_at
      ? new Date(l.logged_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: true })
      : null
    return `${time ? `[${time}] ` : ''}${l.meal_type}: ${l.food_name}${l.calories ? ` (${l.calories} kcal, ${l.protein_g}g P, ${l.carbs_g}g C, ${l.fat_g}g F)` : ''}`
  }).join('\n')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totals = logs.reduce((a: any, l: any) => ({
    cal:     a.cal     + (l.calories  || 0),
    protein: a.protein + (+l.protein_g || 0),
    carbs:   a.carbs   + (+l.carbs_g  || 0),
    fat:     a.fat     + (+l.fat_g    || 0),
    fiber:   a.fiber   + (+l.fiber_g  || 0),
  }), { cal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 })

  const waterNote = waterMl != null
    ? `Water today: ${waterMl}ml / 4000ml goal (${Math.round((waterMl / 4000) * 100)}%)\n`
    : ''

  const prompt = `You are a warm, knowledgeable nutrition coach. Analyze today's food and drink intake and give personal feedback.

${waterNote}Today's meals and drinks:
${timeline}

Running totals vs goals:
Calories: ${totals.cal} / ${goals?.calories ?? 2000} kcal
Protein:  ${totals.protein.toFixed(1)} / ${goals?.protein_g ?? 150}g
Carbs:    ${totals.carbs.toFixed(1)} / ${goals?.carbs_g ?? 250}g
Fat:      ${totals.fat.toFixed(1)} / ${goals?.fat_g ?? 65}g
Fiber:    ${totals.fiber.toFixed(1)} / ${goals?.fiber_g ?? 30}g

Reply with JSON only — no markdown, no code fences:
{
  "type": "complement" | "suggestion" | "neutral",
  "message": "2-3 sentences of specific, warm feedback. Mention actual foods by name. If doing well, genuinely praise specific good choices. If improvements needed, give ONE clear actionable suggestion. If incomplete (early in the day), acknowledge and encourage. Be human and concise."
}

Use type="complement" if overall intake is on track (≥80% of calorie + protein goals), type="suggestion" if there are meaningful gaps, type="neutral" if intake is very low or too early to judge.`

  try {
    const res = await openai.chat.completions.create({
      model:      'gpt-4o-mini',
      max_tokens: 220,
      messages:   [{ role: 'user', content: prompt }],
    })
    const text  = res.choices[0]?.message?.content ?? ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('Unexpected response format')
    return NextResponse.json(JSON.parse(match[0]))
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Analysis failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
