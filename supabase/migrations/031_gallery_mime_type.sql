-- Add mime_type to user_gallery so the client can render non-image files correctly.
ALTER TABLE public.user_gallery ADD COLUMN IF NOT EXISTS mime_type TEXT;
