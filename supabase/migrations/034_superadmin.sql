-- Superadmin role: full read + write access to all user data

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS is_superadmin BOOLEAN NOT NULL DEFAULT false;

-- Helper function used in RLS and API guards
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT COALESCE(
    (SELECT is_superadmin FROM public.user_profiles WHERE id = auth.uid()),
    false
  );
$$;
