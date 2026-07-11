-- ============================================================
-- 039_bank_email_sync.sql
-- Gmail-based auto-import of bank alert emails into transactions
-- ============================================================

CREATE TABLE public.bank_email_connections (
  user_id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  gmail_email     TEXT,
  refresh_token   TEXT NOT NULL,
  sync_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  last_synced_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS enabled with NO policies: this table holds a secret refresh token,
-- so only the service-role (admin client, server-only) can read/write it.
ALTER TABLE public.bank_email_connections ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS source      TEXT NOT NULL DEFAULT 'manual';

-- Dedup key for auto-imported transactions (e.g. Gmail message id).
-- Partial index so manual entries (external_id IS NULL) are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS transactions_user_external_id_uniq
  ON public.transactions (user_id, external_id)
  WHERE external_id IS NOT NULL;
