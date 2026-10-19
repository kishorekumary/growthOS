-- 055_usernames.sql
-- Optional username for signing in with "username + password" instead of
-- the email address. Stored lowercase; unique; 3–30 characters of a–z, 0–9,
-- dot and underscore, starting and ending with a letter or digit.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS username TEXT;

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_username_format;
ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_username_format
  CHECK (username IS NULL OR username ~ '^[a-z0-9][a-z0-9._]{1,28}[a-z0-9]$');

CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_username_key
  ON public.user_profiles (username);
