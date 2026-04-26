import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { openai } from '@/lib/claude'

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const

const SYSTEM_PROMPT = `You are an expert fitness coach creating personalised weekly workout plans.
Always respond with valid JSON only — no markdown, no prose, just the JSON object.
The JSON must have exactly these keys: monday, tuesday, wednesday, thursday, friday, saturday, sunday.
Each day value is an object with:
  - name: string (workout title, e.g. "Upper Body Strength" or "Rest Day")
  - type: one of "strength" | "cardio" | "yoga" | "sports" | "rest"
  - duration_mins: number (0 for rest days)
  - exercises: array of { name: string, sets: number, reps: string } (empty array for rest days)
Create a realistic, balanced plan. Include at least 1–2 rest days. Scale intensity to the user's fitness level.`

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('fitness_profile')
    .select('fitness_level, primary_goal, current_weight, target_weight, height_cm, activity_days, dietary_pref')
    .eq('user_id', user.id)
    .maybeSingle()

  const userContext = profile
    ? `Fitness level: ${profile.fitness_level ?? 'intermediate'}
Goal: ${profile.primary_goal ?? 'general fitness'}
Activity days per week: ${profile.activity_days ?? 3}
Current weight: ${profile.current_weight ?? 'unknown'} kg, Target: ${profile.target_weight ?? 'unknown'} kg
Dietary preference: ${profile.dietary_pref ?? 'none'}`
    : 'Fitness level: intermediate, Goal: general fitness, Activity days: 3'

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Create a personalised 7-day workout plan for this user:\n${userContext}` },
      ],
      max_tokens: 2048,
      temperature: 0.7,
    })

    const raw = completion.choices[0]?.message?.content?.trim() ?? '{}'
    let plan: Record<string, unknown>

    try {
      plan = JSON.parse(raw)
    } catch {
      plan = {}
    }

    for (const day of DAYS) {
      if (!plan[day]) {
        plan[day] = { name: 'Rest Day', type: 'rest', duration_mins: 0, exercises: [] }
      }
    }

    await supabase.from('workout_plans').insert({ user_id: user.id, plan })

    return NextResponse.json({ plan })
  } catch (err) {
    console.error('fitness-plan error', err)
    return NextResponse.json({ error: 'Failed to generate plan' }, { status: 500 })
  }
}
