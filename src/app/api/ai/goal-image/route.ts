import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { openai } from '@/lib/openai'

export async function POST(req: Request) {
  // ── Auth ──────────────────────────────────────────────────────
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const { goalId, prompt } = (body ?? {}) as { goalId?: string; prompt?: string }
  if (!goalId || !prompt) {
    return Response.json({ error: 'goalId and prompt are required' }, { status: 400 })
  }

  const admin = createSupabaseAdminClient()

  // ── Generate image (returns a temporary URL) ─────────────────
  let tempUrl: string
  try {
    const imageResponse = await openai.images.generate({
      model: 'dall-e-2',
      prompt: `${prompt}. Make it inspiring, aspirational and high quality.`,
      n: 1,
      size: '512x512',
    })
    const url = (imageResponse.data ?? [])[0]?.url
    if (!url) return Response.json({ error: 'DALL-E returned no image URL' }, { status: 500 })
    tempUrl = url
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[goal-image] DALL-E error:', msg)
    return Response.json({ error: `Image generation failed: ${msg}` }, { status: 500 })
  }

  // ── Fetch image bytes and upload to Supabase Storage ─────────
  const path = `${user.id}/${goalId}.png`
  try {
    const imageRes = await fetch(tempUrl)
    if (!imageRes.ok) throw new Error(`Failed to fetch generated image: ${imageRes.status}`)
    const imageBuffer = Buffer.from(await imageRes.arrayBuffer())

    await admin.storage.createBucket('goal-visions', { public: true }).catch(() => {})

    const { error: uploadError } = await admin.storage
      .from('goal-visions')
      .upload(path, imageBuffer, { upsert: true, contentType: 'image/png' })

    if (uploadError) {
      console.error('[goal-image] upload error:', uploadError)
      return Response.json({ error: `Storage upload failed: ${uploadError.message}` }, { status: 500 })
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[goal-image] storage error:', msg)
    return Response.json({ error: `Storage error: ${msg}` }, { status: 500 })
  }

  // ── Persist URL on the goal ───────────────────────────────────
  const { data: { publicUrl } } = admin.storage.from('goal-visions').getPublicUrl(path)

  // Use admin client — server client session cookie may not resolve in API routes
  const { error: updateError } = await admin
    .from('user_goals')
    .update({ vision_image_url: publicUrl })
    .eq('id', goalId)
    .eq('user_id', user.id)

  if (updateError) {
    console.error('[goal-image] update error:', updateError)
    return Response.json({ error: `Failed to save image URL: ${updateError.message}` }, { status: 500 })
  }

  return Response.json({ imageUrl: publicUrl })
}
