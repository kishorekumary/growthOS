-- ============================================================
-- GrowthOS — Initial Schema
-- ============================================================

-- ============================================================
-- 1. user_profiles
-- ============================================================
CREATE TABLE public.user_profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     TEXT,
  age           SMALLINT,
  gender        TEXT,
  occupation    TEXT,
  country       TEXT,
  currency      TEXT NOT NULL DEFAULT 'USD',
  avatar_url    TEXT,
  onboarding_done BOOLEAN NOT NULL DEFAULT FALSE,
  primary_goals TEXT[] NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 2. personality_assessments
-- ============================================================
CREATE TABLE public.personality_assessments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mbti_type   TEXT,
  answers     JSONB NOT NULL DEFAULT '{}',
  scores      JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. personality_habits
-- ============================================================
CREATE TABLE public.personality_habits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_name      TEXT NOT NULL,
  description     TEXT,
  streak_count    INT NOT NULL DEFAULT 0,
  longest_streak  INT NOT NULL DEFAULT 0,
  last_done_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4. journal_entries
-- ============================================================
CREATE TABLE public.journal_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  content     TEXT NOT NULL,
  mood        SMALLINT CHECK (mood BETWEEN 1 AND 10),
  ai_feedback TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 5. fitness_profile
-- ============================================================
CREATE TABLE public.fitness_profile (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  fitness_level   TEXT,
  primary_goal    TEXT,
  current_weight  NUMERIC(5,2),
  target_weight   NUMERIC(5,2),
  height_cm       NUMERIC(5,1),
  activity_days   SMALLINT CHECK (activity_days BETWEEN 0 AND 7),
  dietary_pref    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 6. workout_logs
-- ============================================================
CREATE TABLE public.workout_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  workout_type    TEXT NOT NULL,
  duration_mins   SMALLINT,
  exercises       JSONB NOT NULL DEFAULT '[]',
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 7. financial_profile
-- ============================================================
CREATE TABLE public.financial_profile (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  monthly_income    NUMERIC(12,2),
  monthly_expenses  JSONB NOT NULL DEFAULT '{}',
  total_savings     NUMERIC(12,2) DEFAULT 0,
  total_debt        NUMERIC(12,2) DEFAULT 0,
  investment_exp    TEXT,
  financial_score   SMALLINT CHECK (financial_score BETWEEN 0 AND 100),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 8. finance_goals
-- ============================================================
CREATE TABLE public.finance_goals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_name       TEXT NOT NULL,
  goal_type       TEXT NOT NULL,
  target_amount   NUMERIC(12,2) NOT NULL,
  current_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
  deadline_date   DATE,
  is_completed    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 9. transactions
-- ============================================================
CREATE TABLE public.transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  txn_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  type            TEXT NOT NULL CHECK (type IN ('expense', 'income', 'savings')),
  category        TEXT NOT NULL,
  amount          NUMERIC(12,2) NOT NULL,
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 10. book_preferences
-- ============================================================
CREATE TABLE public.book_preferences (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  genres            TEXT[] NOT NULL DEFAULT '{}',
  books_per_month   SMALLINT,
  preferred_length  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 11. reading_log
-- ============================================================
CREATE TABLE public.reading_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_title  TEXT NOT NULL,
  author      TEXT,
  genre       TEXT,
  status      TEXT NOT NULL DEFAULT 'want_to_read'
                CHECK (status IN ('want_to_read', 'reading', 'completed')),
  rating      SMALLINT CHECK (rating BETWEEN 1 AND 5),
  ai_summary  TEXT,
  started_at  DATE,
  finished_at DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 12. ai_conversations
-- ============================================================
CREATE TABLE public.ai_conversations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section     TEXT NOT NULL,
  session_id  UUID NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT NOT NULL,
  tokens_used INT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_conversations_session
  ON public.ai_conversations (session_id, created_at);

-- ============================================================
-- 13. notifications
-- ============================================================
CREATE TABLE public.notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,
  title         TEXT NOT NULL,
  body          TEXT,
  section       TEXT,
  is_read       BOOLEAN NOT NULL DEFAULT FALSE,
  scheduled_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE public.user_profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personality_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personality_habits   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fitness_profile      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_profile    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_goals        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_preferences     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_log          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications        ENABLE ROW LEVEL SECURITY;

-- Macro: each table gets SELECT / INSERT / UPDATE / DELETE policies
-- scoped to auth.uid() = user_id (or id for user_profiles)

-- user_profiles (PK is id, not user_id)
CREATE POLICY "users: own profile" ON public.user_profiles
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- helper to generate the four policies for tables that use user_id
DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY[
    'personality_assessments',
    'personality_habits',
    'journal_entries',
    'fitness_profile',
    'workout_logs',
    'financial_profile',
    'finance_goals',
    'transactions',
    'book_preferences',
    'reading_log',
    'ai_conversations',
    'notifications'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format(
      'CREATE POLICY "own data" ON public.%I FOR ALL
       USING (auth.uid() = user_id)
       WITH CHECK (auth.uid() = user_id);',
      tbl
    );
  END LOOP;
END $$;
