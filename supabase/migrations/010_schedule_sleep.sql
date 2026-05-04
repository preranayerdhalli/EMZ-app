-- Migration 010: Add sleep schedule columns + fix gender constraint

-- Sleep window columns on user_settings
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS sleep_start_hour SMALLINT NOT NULL DEFAULT 23,
  ADD COLUMN IF NOT EXISTS sleep_end_hour   SMALLINT NOT NULL DEFAULT 7;

-- Fix gender constraint to include 'other'
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_gender_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_gender_check
  CHECK (gender IN ('male', 'female', 'other'));
