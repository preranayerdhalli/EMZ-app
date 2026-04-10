-- Migration 005: Tasks and subtasks
-- Run AFTER 001_users.sql

CREATE TABLE IF NOT EXISTS public.tasks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  work_type         TEXT NOT NULL CHECK (work_type IN (
                      'deep', 'creative', 'admin', 'chore', 'recovery', 'learning', 'social'
                    )),
  priority          TEXT NOT NULL DEFAULT 'medium'
                    CHECK (priority IN ('high', 'medium', 'low')),
  date              DATE NOT NULL,
  start_minutes     SMALLINT,           -- null = unscheduled
  end_minutes       SMALLINT,
  duration_minutes  SMALLINT NOT NULL DEFAULT 60,
  flexibility       TEXT NOT NULL DEFAULT 'today'
                    CHECK (flexibility IN ('today', 'this_week', 'flexible', 'specific')),
  is_recovery       BOOLEAN NOT NULL DEFAULT false,
  completed         BOOLEAN NOT NULL DEFAULT false,
  repeat_enabled    BOOLEAN NOT NULL DEFAULT false,
  repeat_days       SMALLINT[],         -- Mon=0 … Sun=6
  repeat_end_date   DATE,
  is_procrastinated BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.subtasks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id           UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  duration_minutes  SMALLINT NOT NULL DEFAULT 30,
  completed         BOOLEAN NOT NULL DEFAULT false,
  sort_order        SMALLINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS tasks_user_date ON public.tasks (user_id, date);

ALTER TABLE public.tasks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks: own rows"
  ON public.tasks FOR ALL USING (auth.uid() = user_id);

-- Subtasks inherit security from parent task's user_id
CREATE POLICY "subtasks: via task"
  ON public.subtasks FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_id AND t.user_id = auth.uid()
  ));
