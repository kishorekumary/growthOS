import { NextRequest, NextResponse } from 'next/server'
import { openai } from '@/lib/claude'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  try {
    const { data: { user } } = await createSupabaseServerClient().auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { foodName } = await req.json()
    if (!foodName?.trim()) {
      return NextResponse.json({ error: 'Missing food name' }, { status: 400 })
    }

    let text: string
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 256,
        messages: [{
          role: 'user',
          content: `You are a registered dietitian. Estimate the nutritional content for: "${foodName.trim()}"

Assume a typical single serving / standard portion unless the description implies otherwise.

Return ONLY a valid JSON object — no markdown, no explanation, no code fences:
{
  "food_name": "cleaned-up descriptive name",
  "calories": integer,
  "protein_g": number with 1 decimal,
  "carbs_g": number with 1 decimal,
  "fiber_g": number with 1 decimal,
  "fat_g": number with 1 decimal,
  "notes": "one short sentence with portion assumption and any caveats"
}`,
        }],
      })
      text = response.choices[0]?.message?.content ?? ''
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[nutrition/autofill] OpenAI error:', msg)
      return NextResponse.json({ error: `AI error: ${msg}` }, { status: 502 })
    }

    const match = text.match(/\{[\s\S]*\}/)
    if (!match) {
      console.error('[nutrition/autofill] Unparseable response:', text.slice(0, 200))
      return NextResponse.json({ error: 'Could not parse nutritional data' }, { status: 500 })
    }

    try {
      return NextResponse.json(JSON.parse(match[0]))
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in AI response' }, { status: 500 })
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[nutrition/autofill] Unexpected error:', msg)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
