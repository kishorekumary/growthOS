import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createSupabaseServerClient } from '@/lib/supabase-server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  // Require authenticated user
  const { data: { user } } = await createSupabaseServerClient().auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { imageBase64, mediaType } = await req.json()
  if (!imageBase64 || !mediaType) {
    return NextResponse.json({ error: 'Missing image data' }, { status: 400 })
  }

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType as Anthropic.Base64ImageSource['media_type'], data: imageBase64 },
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

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return NextResponse.json({ error: 'Could not parse nutritional data from image' }, { status: 500 })

  try {
    return NextResponse.json(JSON.parse(match[0]))
  } catch {
    return NextResponse.json({ error: 'Invalid response from AI' }, { status: 500 })
  }
}
