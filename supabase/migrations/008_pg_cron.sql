-- Migration 008: Schedule nightly-digest via pg_cron
-- Requires: Supabase Pro plan (pg_cron + pg_net are enabled by default on Pro).
--
-- How to run:
--   Supabase Dashboard → SQL Editor → paste and execute.
--
-- After running this migration you must also set two database parameters
-- so the cron job can reach your edge function:
--
--   Supabase Dashboard → Project Settings → Database → Configuration → Parameters:
--     app.supabase_url    = https://<your-project-ref>.supabase.co
--     app.service_role_key = <your service role key>   (Settings → API)
--
-- These are read at runtime by the cron job below via current_setting().

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any existing schedule with this name before (re-)creating it.
SELECT cron.unschedule('nightly-digest') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'nightly-digest'
);

SELECT cron.schedule(
  'nightly-digest',
  '0 21 * * *',   -- 9 pm UTC every day
  $$
  SELECT net.http_post(
    url     := 'https://faospfwlzttyhigmerhs.supabase.co/functions/v1/nightly-digest',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhb3NwZndsenR0eWhpZ21lcmhzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTc5NDkyOSwiZXhwIjoyMDkxMzcwOTI5fQ.ptsaQIkPvZv-_us6ka5PL5YXxNLYIXBc6qbo4o2z1Q4'
               ),
    body    := '{}'::jsonb
  );
  $$
);
