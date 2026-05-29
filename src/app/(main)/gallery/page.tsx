import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import Gallery, { type GalleryItem } from '@/components/gallery/Gallery'

export default async function GalleryPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data }, { data: profile }] = await Promise.all([
    supabase
      .from('user_gallery')
      .select('id, user_id, storage_path, url, caption, tags, mime_type, file_size, is_global, created_at')
      .or(`user_id.eq.${user.id},is_global.eq.true`)
      .order('created_at', { ascending: false }),
    supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single(),
  ])

  const items: GalleryItem[] = (data ?? []).map(r => ({
    id:           r.id,
    user_id:      r.user_id,
    storage_path: r.storage_path,
    url:          r.url,
    caption:      r.caption ?? null,
    tags:         r.tags ?? [],
    mime_type:    r.mime_type ?? null,
    file_size:    r.file_size ?? 0,
    is_global:    r.is_global ?? false,
    created_at:   r.created_at,
  }))

  return (
    <div className="min-h-screen bg-[#06060f]">
      <Gallery initialItems={items} userId={user.id} isAdmin={profile?.is_admin ?? false} />
    </div>
  )
}
