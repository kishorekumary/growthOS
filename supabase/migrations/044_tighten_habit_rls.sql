-- Tighten personality_habits RLS: the previous policies (033_admin.sql) gave
-- any admin blanket SELECT/INSERT/UPDATE/DELETE access to every user's rows,
-- not just their own + global ones. No shipped code path actually needs that:
-- the admin dashboard pages (src/app/(main)/admin/**) and the superadmin
-- generic editor (src/app/api/superadmin/edit/route.ts) all read/write via
-- the service-role client, which bypasses RLS entirely regardless of these
-- policies. The only session-bound (RLS-checked) admin path is
-- src/app/api/admin/global-habits/route.ts, which only ever touches rows
-- where is_global = true — so that's the only case admins need a bypass for.

DROP POLICY IF EXISTS "select habits" ON public.personality_habits;
DROP POLICY IF EXISTS "insert habits" ON public.personality_habits;
DROP POLICY IF EXISTS "update habits" ON public.personality_habits;
DROP POLICY IF EXISTS "delete habits" ON public.personality_habits;

-- Own habits + any global habit (visible to everyone) — no admin bypass
-- needed, is_global = true already covers legitimate cross-user visibility.
CREATE POLICY "select habits" ON public.personality_habits
  FOR SELECT USING (auth.uid() = user_id OR is_global = true);

-- Always insert as yourself. Admin-created global habits are inserted with
-- the creating admin's own user_id (see global-habits/route.ts), so no
-- bypass is needed here either.
CREATE POLICY "insert habits" ON public.personality_habits
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Your own habits, or any global habit if you're an admin (so any admin can
-- edit/delete a global habit regardless of which admin originally created
-- it) — but never another user's private habit.
CREATE POLICY "update habits" ON public.personality_habits
  FOR UPDATE USING (auth.uid() = user_id OR (is_global = true AND public.is_admin()));

CREATE POLICY "delete habits" ON public.personality_habits
  FOR DELETE USING (auth.uid() = user_id OR (is_global = true AND public.is_admin()));
