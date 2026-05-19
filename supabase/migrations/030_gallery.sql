-- ============================================================
-- 030_gallery.sql
-- Gallery feature: image/screenshot storage for daily process tracking
-- ============================================================

-- 1. Gallery metadata table
CREATE TABLE IF NOT EXISTS public.user_gallery (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path TEXT        NOT NULL,
  url          TEXT        NOT NULL,
  caption      TEXT,
  tags         TEXT[]      NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_gallery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own data" ON public.user_gallery
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2. Storage bucket (public so images can be served via CDN URL)
INSERT INTO storage.buckets (id, name, public)
VALUES ('gallery', 'gallery', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage RLS policies
--    Files are stored as <user_id>/<filename> so we scope by the first path segment.

CREATE POLICY "gallery upload own folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'gallery'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "gallery read own files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'gallery'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "gallery delete own files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'gallery'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
