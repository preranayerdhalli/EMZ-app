-- Migration 007: Add profile fields to users (name, birthday, gender)

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS birthday  DATE,
  ADD COLUMN IF NOT EXISTS gender    TEXT CHECK (gender IN ('male', 'female'));
