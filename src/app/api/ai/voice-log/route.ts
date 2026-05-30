import { NextRequest, NextResponse } from 'next/server'
import { openai } from '@/lib/claude'
import { createSupabaseServerClient } from '@/lib/supabase-server'

const SYSTEM = `You are a personal growth assistant that parses voice commands into structured log entries.

Supported intents and exact JSON shapes:

TRANSACTION (spending, earning, saving money):
{"type":"transaction","txn_type":"expense"|"income"|"savings","amount":<number>,"category":<string>,"description":"<text>","summary":"<1 sentence>"}
Valid expense categories: Food, Rent, Transport, Entertainment, Healthcare, Shopping, Utilities, Other
Valid income categories: Salary, Freelance, Investment, Gift, Other
Valid savings categories: Emergency Fund, Retirement, Goal, Other

WORKOUT (any physical exercise):
{"type":"workout","workout_type":"cardio"|"strength"|"yoga"|"sports"|"rest","duration_mins":<number|null>,"notes":"<text>","summary":"<1 sentence>"}

MEAL (food consumed):
{"type":"meal","meal_type":"breakfast"|"lunch"|"dinner"|"snack","food_name":"<text>","summary":"<1 sentence>"}
Infer meal_type from time references or context ("morning" → breakfast, "noon/lunch" → lunch, "evening/dinner" → dinner, else "snack").

HABIT (completing a habit or daily routine):
{"type":"habit","habit_name":"<extracted name>","summary":"<1 sentence>"}

UNKNOWN (cannot parse):
{"type":"unknown","summary":"Could not understand the command."}

Rules:
- Return ONLY the JSON object — no markdown, no code fences, no explanation.
- Amounts should always be numeric (strip currency words like rupees, dollars, INR).
- Map workout activities: run/jog/walk/cycling/swim → cardio, gym/weights/push-ups/pull-ups → strength, yoga/pilates → yoga, football/cricket/tennis/basketball → sports.
- If amount is mentioned with a verb like "spent", "paid", "bought" → expense. "earned", "received", "got paid" → income. "saved", "deposited", "invested" → savings.`

export async function POST(req: NextRequest) {
  const { data: { user } } = await createSupabaseServerClient().auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { transcript } = await req.json()
  if (!transcript?.trim()) return NextResponse.json({ error: 'transcript required' }, { status: 400 })

  let text: string
  try {
    const res = await openai.chat.completions.create({
      model:      'gpt-4o-mini',
      max_tokens: 256,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user',   content: transcript.trim() },
      ],
    })
    text = res.choices[0]?.message?.content ?? ''
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `AI error: ${msg}` }, { status: 502 })
  }

  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return NextResponse.json({ error: 'Could not parse AI response' }, { status: 500 })

  try {
    return NextResponse.json(JSON.parse(match[0]))
  } catch {
    return NextResponse.json({ error: 'Invalid JSON from AI' }, { status: 500 })
  }
}
