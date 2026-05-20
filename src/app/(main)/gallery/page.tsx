import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import Gallery, { type GalleryItem } from '@/components/gallery/Gallery'

export default async function GalleryPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase
    .from('user_gallery')
    .select('id, storage_path, url, caption, tags, mime_type, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const items: GalleryItem[] = (data ?? []).map(r => ({
    id:           r.id,
    storage_path: r.storage_path,
    url:          r.url,
    caption:      r.caption ?? null,
    tags:         r.tags ?? [],
    mime_type:    r.mime_type ?? null,
    created_at:   r.created_at,
  }))

  return (
    <div className="min-h-screen bg-[#06060f]">
      <Gallery initialItems={items} userId={user.id} />
    </div>
  )
}
