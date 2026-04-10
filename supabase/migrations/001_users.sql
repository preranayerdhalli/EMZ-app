-- Migration 001: Core users & settings
-- Run in Supabase SQL editor (Dashboard → SQL Editor)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Mirror of auth.users — populated by trigger on first sign-in
CREATE TABLE IF NOT EXISTS public.users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT UNIQUE NOT NULL,
  timezone    TEXT NOT NULL DEFAULT 'UTC',
  chronotype  TEXT NOT NULL DEFAULT 'neutral'
              CHECK (chronotype IN ('morning', 'neutral', 'evening')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id              UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  work_start_hour      SMALLINT NOT NULL DEFAULT 9,
  work_end_hour        SMALLINT NOT NULL DEFAULT 18,
  onboarding_complete  BOOLEAN NOT NULL DEFAULT false,
  wearable_ios         TEXT,     -- 'apple-health' | null
  wearable_android     TEXT,     -- 'health-connect' | null
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create user + settings rows on new auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users: own row only"
  ON public.users FOR ALL USING (auth.uid() = id);

CREATE POLICY "settings: own row only"
  ON public.user_settings FOR ALL USING (auth.uid() = user_id);
