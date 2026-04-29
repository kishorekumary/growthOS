import { NextRequest, NextResponse } from 'next/server'
import { openai } from '@/lib/openai'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const { data: { user } } = await createSupabaseServerClient().auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { imageBase64, mediaType } = await req.json()
  if (!imageBase64 || !mediaType) {
    return NextResponse.json({ error: 'Missing image data' }, { status: 400 })
  }

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: { url: `data:${mediaType};base64,${imageBase64}` },
        },
        {
          type: 'text',
          text: `You are a registered dietitian. Analyze this food image and estimate nutritional content for the portion shown.

Return ONLY a valid JSON object — no markdown, no explanation, no code fences:
{
  "food_name": "concise descriptive name of the dish",
  "calories": integer (total kcal for visible portion),
  "protein_g": number with 1 decimal,
  "carbs_g": number with 1 decimal,
  "fiber_g": number with 1 decimal,
  "fat_g": number with 1 decimal,
  "notes": "one sentence: what you see and any estimation caveats"
}

Be realistic. Sum all visible items. If uncertain, note it in the notes field.`,
        },
      ],
    }],
  })

  const text = response.choices[0]?.message?.content ?? ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return NextResponse.json({ error: 'Could not parse nutritional data from image' }, { status: 500 })

  try {
    return NextResponse.json(JSON.parse(match[0]))
  } catch {
    return NextResponse.json({ error: 'Invalid response from AI' }, { status: 500 })
  }
}
