import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { openai } from '@/lib/openai'

export async function POST(req: Request) {
  try {
    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new Response('Unauthorized', { status: 401 })

    const { goalId, prompt } = (await req.json()) as { goalId: string; prompt: string }

    if (!goalId || !prompt) {
      return Response.json({ error: 'goalId and prompt are required' }, { status: 400 })
    }

    const fullPrompt = `Inspiring visualization for personal goal: ${prompt}. Make it photorealistic, high quality, aspirational and motivational.`

    const imageResponse = await openai.images.generate({
      model: 'dall-e-3',
      prompt: fullPrompt,
      n: 1,
      size: '1024x1024',
      response_format: 'b64_json',
    })

    const b64 = imageResponse.data[0]?.b64_json
    if (!b64) {
      return Response.json({ error: 'No image data returned from DALL-E' }, { status: 500 })
    }

    const imageBuffer = Buffer.from(b64, 'base64')
    const path = `${user.id}/${goalId}.png`

    const admin = createSupabaseAdminClient()

    // Create bucket if it doesn't already exist — swallow error if it does
    await admin.storage.createBucket('goal-visions', { public: true }).catch(() => {})

    const { error: uploadError } = await admin.storage
      .from('goal-visions')
      .upload(path, imageBuffer, {
        upsert: true,
        contentType: 'image/png',
      })

    if (uploadError) {
      console.error('[goal-image] upload error:', uploadError)
      return Response.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: { publicUrl } } = admin.storage.from('goal-visions').getPublicUrl(path)

    const { error: updateError } = await supabase
      .from('user_goals')
      .update({ vision_image_url: publicUrl })
      .eq('id', goalId)
      .eq('user_id', user.id)

    if (updateError) {
      console.error('[goal-image] update error:', updateError)
      return Response.json({ error: updateError.message }, { status: 500 })
    }

    return Response.json({ imageUrl: publicUrl })
  } catch (err) {
    console.error('[goal-image] unexpected error:', err)
    return Response.json({ error: 'Failed to generate goal image. Please try again.' }, { status: 500 })
  }
}
