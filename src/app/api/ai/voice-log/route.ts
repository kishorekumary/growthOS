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
{"type":"meal","meal_type":"breakfast"|"lunch"|"dinner"|"snack","food_name":"<full description with quantity>","summary":"<1 sentence>"}
Rules for food_name:
- ALWAYS preserve quantities and descriptors: "two egg dosa" → "two egg dosa" (NOT "dosa")
- "I had X for Y" → food_name: X (verbatim, with quantity), meal_type: Y
- Include preparation: "scrambled eggs" not just "eggs", "masala oats" not just "oats"
- Examples: "2 egg dosa", "a bowl of oatmeal with fruits", "chicken biryani half plate"
Infer meal_type from context: "morning/breakfast" → breakfast, "lunch/noon/afternoon" → lunch, "dinner/evening/night" → dinner, else snack.

HABIT (completing a habit or daily routine):
{"type":"habit","habit_name":"<core habit name only>","summary":"<1 sentence>"}
Rules for habit_name:
- If command starts with "Habit" or "habit", strip that prefix word entirely.
- Strip trailing words: done, completed, finished, today, again, already.
- Example: "Habit Book reading done" → habit_name: "Book reading"
- Example: "habit meditation completed" → habit_name: "meditation"
- Example: "completed my morning run" → habit_name: "morning run"
- Keep only the core activity name.

JOURNAL (personal journal entry — starts with "journal" keyword OR is clearly a diary/reflection):
{"type":"journal","title":<string|null>,"content":"<full text after the journal keyword>","summary":"<1 sentence>"}
Rules:
- Strip the leading "Journal" or "journal" keyword from the content.
- title: extract a short title if the user says one (e.g. "Journal title Today's wins: ..."), otherwise null.
- content: the full journal text the user dictated.

UNKNOWN (cannot parse):
{"type":"unknown","summary":"Could not understand the command."}

QUICK EXPENSE SHORTHAND (highest priority rule — check this first):
Any command that is ONLY a food/item name followed by a number — with no eating/activity verbs — is a quick expense log, NOT a meal entry.
Pattern: "<what> <amount>" where <what> is a food, drink, meal name, or any item, and <amount> is a number.
→ Always map to: {"type":"transaction","txn_type":"expense","amount":<number>,"category":"Food","description":"<what>","summary":"Logged ₹<amount> <what> expense"}
Examples:
- "breakfast 85"   → {type:"transaction",txn_type:"expense",amount:85,category:"Food",description:"breakfast",summary:"Logged ₹85 breakfast expense"}
- "lunch 200"      → {type:"transaction",txn_type:"expense",amount:200,category:"Food",description:"lunch",summary:"Logged ₹200 lunch expense"}
- "chai 30"        → {type:"transaction",txn_type:"expense",amount:30,category:"Food",description:"chai",summary:"Logged ₹30 chai expense"}
- "coffee 150"     → {type:"transaction",txn_type:"expense",amount:150,category:"Food",description:"coffee",summary:"Logged ₹150 coffee expense"}
- "dinner 350"     → {type:"transaction",txn_type:"expense",amount:350,category:"Food",description:"dinner",summary:"Logged ₹350 dinner expense"}
- "auto 60"        → {type:"transaction",txn_type:"expense",amount:60,category:"Transport",description:"auto",summary:"Logged ₹60 auto expense"}
- "petrol 500"     → {type:"transaction",txn_type:"expense",amount:500,category:"Transport",description:"petrol",summary:"Logged ₹500 petrol expense"}
Distinguish from meal: "had breakfast" / "ate breakfast" / "I had breakfast" → MEAL. Bare "breakfast 85" → TRANSACTION.

General rules:
- Return ONLY the JSON object — no markdown, no code fences, no explanation.
- Amounts should always be numeric (strip currency words like rupees, dollars, INR, ₹).
- Map workout activities: run/jog/walk/cycling/swim → cardio, gym/weights/push-ups/pull-ups → strength, yoga/pilates → yoga, football/cricket/tennis/basketball → sports.
- If amount is mentioned with "spent", "paid", "bought" → expense. "earned", "received", "got paid" → income. "saved", "deposited", "invested" → savings.`

export async function POST(req: NextRequest) {
  const { data: { user } } = await createSupabaseServerClient().auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { transcript } = await req.json()
  if (!transcript?.trim()) return NextResponse.json({ error: 'transcript required' }, { status: 400 })

  let text: string
  try {
    const res = await openai.chat.completions.create({
      model:      'gpt-4o-mini',
      max_tokens: 512,
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
