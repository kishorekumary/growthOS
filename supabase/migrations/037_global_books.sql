-- Global books: admin-pinned books visible to all users (read-only)

-- 1. Add is_global flag
ALTER TABLE public.reading_log
  ADD COLUMN IF NOT EXISTS is_global BOOLEAN NOT NULL DEFAULT false;

-- 2. Replace the existing all-in-one RLS policy with split policies
--    that follow the same pattern as personality_habits (033) and user_gallery (035)
DROP POLICY IF EXISTS "users can manage own reading log"  ON public.reading_log;
DROP POLICY IF EXISTS "own data"                          ON public.reading_log;
DROP POLICY IF EXISTS "select reading log"                ON public.reading_log;
DROP POLICY IF EXISTS "insert reading log"                ON public.reading_log;
DROP POLICY IF EXISTS "update reading log"                ON public.reading_log;
DROP POLICY IF EXISTS "delete reading log"                ON public.reading_log;

-- Everyone can see their own books OR books marked global OR admins see all
CREATE POLICY "select reading log" ON public.reading_log
  FOR SELECT USING (auth.uid() = user_id OR is_global = true OR public.is_admin());

-- Only own rows on insert
CREATE POLICY "insert reading log" ON public.reading_log
  FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- Own rows OR admin (admin sets is_global on owner's rows)
CREATE POLICY "update reading log" ON public.reading_log
  FOR UPDATE USING (auth.uid() = user_id OR public.is_admin());

-- Own rows OR admin
CREATE POLICY "delete reading log" ON public.reading_log
  FOR DELETE USING (auth.uid() = user_id OR public.is_admin());
