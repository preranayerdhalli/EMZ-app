-- Migration 002: Biometric readings
-- Run AFTER 001_users.sql

CREATE TABLE IF NOT EXISTS public.biometric_readings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date                DATE NOT NULL,

  -- Sleep
  sleep_duration_min  SMALLINT,          -- total sleep in minutes
  sleep_efficiency    NUMERIC(5,2),      -- 0-100 %
  deep_sleep_pct      NUMERIC(5,2),      -- % of total sleep that is deep
  rem_sleep_pct       NUMERIC(5,2),      -- % of total sleep that is REM

  -- Cardiac
  hrv_ms              NUMERIC(6,2),      -- RMSSD in ms (overnight average)
  hrv_7day_avg        NUMERIC(6,2),      -- rolling 7-day baseline (for relative scoring)
  resting_hr          SMALLINT,          -- beats per minute

  -- Recovery
  recovery_score      NUMERIC(5,2),      -- 0-100 (from wearable or computed)
  body_battery_am     NUMERIC(5,2),      -- 0-100 morning charge level

  -- Period cycle (AES-256 encrypted — key stored in Supabase Vault)
  -- Decrypt with: pgp_sym_decrypt(period_phase_enc, current_setting('app.encryption_key'))
  period_phase_enc    BYTEA,             -- encrypted: 'follicular'|'ovulatory'|'luteal'|'menstrual'
  period_day_enc      BYTEA,             -- encrypted: cycle day 1-35

  source              TEXT NOT NULL DEFAULT 'manual'
                      CHECK (source IN ('healthkit', 'health_connect', 'manual')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS biometric_readings_user_date
  ON public.biometric_readings (user_id, date DESC);

ALTER TABLE public.biometric_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "biometrics: own rows"
  ON public.biometric_readings FOR ALL USING (auth.uid() = user_id);
