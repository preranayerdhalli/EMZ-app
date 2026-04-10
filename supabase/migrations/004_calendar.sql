-- Migration 004: Calendar tokens and synced events
-- Run AFTER 001_users.sql

CREATE TABLE IF NOT EXISTS public.calendar_tokens (
  user_id              UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  provider             TEXT NOT NULL CHECK (provider IN ('google', 'microsoft', 'apple')),
  -- Tokens encrypted with pgcrypto before insert (key in Supabase Vault)
  access_token_enc     BYTEA NOT NULL,
  refresh_token_enc    BYTEA,
  expires_at           TIMESTAMPTZ,
  scope                TEXT,
  -- Provider-specific incremental sync cursors
  sync_token           TEXT,    -- Google Calendar nextSyncToken
  delta_link           TEXT,    -- Microsoft Graph @odata.deltaLink
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, provider)
);

CREATE TABLE IF NOT EXISTS public.calendar_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  external_id    TEXT NOT NULL,
  source         TEXT NOT NULL CHECK (source IN ('google', 'microsoft', 'apple')),
  title          TEXT NOT NULL,
  start_at       TIMESTAMPTZ NOT NULL,
  end_at         TIMESTAMPTZ NOT NULL,
  date           DATE NOT NULL,         -- local date of event start (user timezone)
  start_minutes  SMALLINT NOT NULL,     -- minutes since midnight in user local time
  end_minutes    SMALLINT NOT NULL,
  is_all_day     BOOLEAN NOT NULL DEFAULT false,
  is_deleted     BOOLEAN NOT NULL DEFAULT false,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (user_id, source, external_id)
);

CREATE INDEX IF NOT EXISTS calendar_events_user_date
  ON public.calendar_events (user_id, date)
  WHERE NOT is_deleted;

ALTER TABLE public.calendar_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tokens: own rows"
  ON public.calendar_tokens FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "events: own rows"
  ON public.calendar_events FOR ALL USING (auth.uid() = user_id);
