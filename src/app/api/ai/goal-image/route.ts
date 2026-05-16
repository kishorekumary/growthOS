import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'

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

  // ── Generate image via Pollinations.ai ────────────────────────
  // Random seed ensures a fresh generation even for the same prompt
  const seed = Math.floor(Math.random() * 2_147_483_647)
  let imageBuffer: Buffer
  try {
    const encodedPrompt = encodeURIComponent(
      `${prompt}, masterpiece, best quality, highly detailed, sharp focus, professional`
    )
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}` +
      `?width=1024&height=768&model=flux-realism&nologo=true&enhance=true&seed=${seed}`

    const imageRes = await fetch(pollinationsUrl, { signal: AbortSignal.timeout(60_000) })
    if (!imageRes.ok) throw new Error(`Pollinations returned ${imageRes.status}`)
    imageBuffer = Buffer.from(await imageRes.arrayBuffer())
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[goal-image] generation error:', msg)
    return Response.json({ error: `Image generation failed: ${msg}` }, { status: 500 })
  }

  // ── Upload to Supabase Storage ────────────────────────────────
  // Versioned filename so the CDN never serves a stale cached file
  const version = Date.now()
  const path = `${user.id}/${goalId}-${version}.png`
  try {
    await admin.storage.createBucket('goal-visions', { public: true }).catch(() => {})

    const { error: uploadError } = await admin.storage
      .from('goal-visions')
      .upload(path, imageBuffer, { contentType: 'image/png' })

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
