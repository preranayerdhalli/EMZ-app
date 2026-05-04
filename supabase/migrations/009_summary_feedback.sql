-- Migration 009: Add feedback columns to daily_summaries
-- Stores whether the user found the daily summary accurate (thumbs up/down).
-- Used in Phase 3 to measure which summary templates resonate and to tune
-- the prompt/algorithm for AI-generated summaries.
--
-- Run: Supabase Dashboard → SQL Editor → execute.

ALTER TABLE public.daily_summaries
  ADD COLUMN IF NOT EXISTS feedback      TEXT        CHECK (feedback IN ('up', 'down')),
  ADD COLUMN IF NOT EXISTS feedback_at   TIMESTAMPTZ;

-- Index so we can efficiently pull all feedback for a user across dates.
CREATE INDEX IF NOT EXISTS daily_summaries_feedback_idx
  ON public.daily_summaries (user_id, feedback)
  WHERE feedback IS NOT NULL;
