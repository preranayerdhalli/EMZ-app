-- Migration 006: Mood check-ins and daily summaries
-- Run AFTER 001_users.sql

CREATE TABLE IF NOT EXISTS public.mood_checkins (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date              DATE NOT NULL,
  checked_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  mood_emoji        TEXT,               -- raw emoji character e.g. '😄'
  mood_score        SMALLINT CHECK (mood_score BETWEEN 1 AND 6),  -- 1=worst, 6=best
  notes             TEXT,               -- free-text from the mood input
  voice_transcript  TEXT,               -- transcribed voice note (if used)
  energy_impact     NUMERIC(4,3)        -- keyword-derived delta: -1.0 to +1.0
);

-- One summary per user per day (upserted by daily-summary edge function)
CREATE TABLE IF NOT EXISTS public.daily_summaries (
  user_id               UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date                  DATE NOT NULL,
  summary_text          TEXT NOT NULL,
  capacity_score        NUMERIC(4,3),     -- 0-1 (blended biometric + mood)
  task_count            SMALLINT,
  meeting_minutes       SMALLINT,
  mood_score            NUMERIC(4,3),     -- averaged from all check-ins for the day
  recommendations_json  JSONB,            -- [{type: string, text: string}]
  generated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, date)
);

CREATE INDEX IF NOT EXISTS mood_checkins_user_date
  ON public.mood_checkins (user_id, date DESC);

ALTER TABLE public.mood_checkins   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mood: own rows"
  ON public.mood_checkins FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "summaries: own rows"
  ON public.daily_summaries FOR ALL USING (auth.uid() = user_id);
