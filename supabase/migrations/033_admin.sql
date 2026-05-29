-- Admin support + global habits

-- 1. is_admin flag on user_profiles
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- 2. is_global flag on personality_habits (admin-introduced habits visible to all)
ALTER TABLE public.personality_habits
  ADD COLUMN IF NOT EXISTS is_global BOOLEAN NOT NULL DEFAULT false;

-- 3. Fix habit_logs unique constraint so multiple users can log the same global habit
ALTER TABLE public.habit_logs
  DROP CONSTRAINT IF EXISTS habit_logs_habit_id_log_date_key;
ALTER TABLE public.habit_logs
  ADD CONSTRAINT habit_logs_habit_id_user_id_log_date_key
  UNIQUE (habit_id, user_id, log_date);

-- 4. Admin check function (used in RLS policies below)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.user_profiles WHERE id = auth.uid()),
    false
  );
$$;

-- 5. personality_habits RLS: read global habits + admin bypass
DROP POLICY IF EXISTS "own data"        ON public.personality_habits;
DROP POLICY IF EXISTS "select habits"   ON public.personality_habits;
DROP POLICY IF EXISTS "insert habits"   ON public.personality_habits;
DROP POLICY IF EXISTS "update habits"   ON public.personality_habits;
DROP POLICY IF EXISTS "delete habits"   ON public.personality_habits;

CREATE POLICY "select habits" ON public.personality_habits
  FOR SELECT USING (auth.uid() = user_id OR is_global = true OR public.is_admin());

CREATE POLICY "insert habits" ON public.personality_habits
  FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "update habits" ON public.personality_habits
  FOR UPDATE USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "delete habits" ON public.personality_habits
  FOR DELETE USING (auth.uid() = user_id OR public.is_admin());

-- 6. user_profiles RLS: admins can read all profiles
-- (is_admin changes only happen via service-role API, not direct client UPDATE)
DROP POLICY IF EXISTS "users: own profile"  ON public.user_profiles;
DROP POLICY IF EXISTS "select profiles"     ON public.user_profiles;
DROP POLICY IF EXISTS "insert own profile"  ON public.user_profiles;
DROP POLICY IF EXISTS "update own profile"  ON public.user_profiles;
DROP POLICY IF EXISTS "delete own profile"  ON public.user_profiles;

CREATE POLICY "select profiles" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "insert own profile" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "update own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "delete own profile" ON public.user_profiles
  FOR DELETE USING (auth.uid() = id);
