-- Global gallery: admin-pinned files visible to all users

-- 1. Add is_global flag
ALTER TABLE public.user_gallery
  ADD COLUMN IF NOT EXISTS is_global BOOLEAN NOT NULL DEFAULT false;

-- 2. Replace the all-in-one "own data" policy with split policies
--    that follow the same pattern as personality_habits in 033_admin.sql
DROP POLICY IF EXISTS "own data" ON public.user_gallery;

CREATE POLICY "select gallery" ON public.user_gallery
  FOR SELECT USING (auth.uid() = user_id OR is_global = true OR public.is_admin());

CREATE POLICY "insert gallery" ON public.user_gallery
  FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "update gallery" ON public.user_gallery
  FOR UPDATE USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "delete gallery" ON public.user_gallery
  FOR DELETE USING (auth.uid() = user_id OR public.is_admin());
