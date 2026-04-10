-- Migration 003: Hourly energy forecasts
-- Run AFTER 002_biometrics.sql

CREATE TABLE IF NOT EXISTS public.energy_forecasts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date                  DATE NOT NULL,
  hour                  SMALLINT NOT NULL CHECK (hour BETWEEN 0 AND 23),
  energy_level          TEXT NOT NULL CHECK (energy_level IN ('high', 'moderate', 'low')),
  suggested_work_type   TEXT NOT NULL CHECK (suggested_work_type IN (
                          'deep', 'creative', 'admin', 'chore', 'recovery', 'learning', 'social'
                        )),
  is_micro_break        BOOLEAN NOT NULL DEFAULT false,
  base_score            NUMERIC(4,3),    -- 0-1, stored for debugging / future ML

  UNIQUE (user_id, date, hour)
);

CREATE INDEX IF NOT EXISTS energy_forecasts_user_date
  ON public.energy_forecasts (user_id, date);

ALTER TABLE public.energy_forecasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "energy: own rows"
  ON public.energy_forecasts FOR ALL USING (auth.uid() = user_id);
