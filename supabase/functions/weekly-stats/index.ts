// Supabase Edge Function: weekly-stats
// Returns 7-day array matching the frontend WEEK_DATA type exactly.
// GET /functions/v1/weekly-stats?weekStart=YYYY-MM-DD
//
// Deploy: supabase functions deploy weekly-stats

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response('Unauthorized', { status: 401, headers: CORS });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return new Response('Unauthorized', { status: 401, headers: CORS });

    const url = new URL(req.url);
    // Default to current week's Monday if not provided
    const weekStart = url.searchParams.get('weekStart') ?? getThisMonday();

    const weekEnd = addDays(weekStart, 6);

    // Fetch biometrics and daily summaries for the week in parallel
    const [bioRes, summaryRes, taskRes, eventRes] = await Promise.all([
      supabase
        .from('biometric_readings')
        .select('date, body_battery_am, recovery_score')
        .eq('user_id', user.id)
        .gte('date', weekStart)
        .lte('date', weekEnd),
      supabase
        .from('daily_summaries')
        .select('date, capacity_score')
        .eq('user_id', user.id)
        .gte('date', weekStart)
        .lte('date', weekEnd),
      supabase
        .from('tasks')
        .select('date, completed')
        .eq('user_id', user.id)
        .gte('date', weekStart)
        .lte('date', weekEnd),
      supabase
        .from('calendar_events')
        .select('date, start_minutes, end_minutes')
        .eq('user_id', user.id)
        .gte('date', weekStart)
        .lte('date', weekEnd)
        .eq('is_deleted', false),
    ]);

    const bioByDate     = indexByDate(bioRes.data ?? []);
    const summaryByDate = indexByDate(summaryRes.data ?? []);
    const tasksByDate   = groupByDate(taskRes.data ?? []);
    const eventsByDate  = groupByDate(eventRes.data ?? []);

    // Build 7-day array — matches frontend WeekDayStat type exactly
    const result = DAY_LABELS.map((day, i) => {
      const date    = addDays(weekStart, i);
      const bio     = bioByDate[date];
      const summary = summaryByDate[date];
      const tasks   = tasksByDate[date] ?? [];
      const events  = eventsByDate[date] ?? [];

      // body_battery_am: 0-100 → 0-1
      const bodyBattery = bio?.body_battery_am != null
        ? clamp(bio.body_battery_am / 100, 0, 1)
        : (summary?.capacity_score ?? 0.5);

      // recovery: recovery_score 0-100 → 0-1
      const recovery = bio?.recovery_score != null
        ? clamp(bio.recovery_score / 100, 0, 1)
        : 0.5;

      // workload: meeting hours + task count, normalised 0-1
      const meetingMins   = events.reduce((sum: number, e: any) => sum + (e.end_minutes - e.start_minutes), 0);
      const meetingFactor = clamp(meetingMins / 480, 0, 0.7); // 8h max
      const taskFactor    = clamp(tasks.length / 10, 0, 0.3); // 10 tasks max
      const workload      = clamp(meetingFactor + taskFactor, 0, 1);

      return { day, bodyBattery, recovery, workload };
    });

    return new Response(
      JSON.stringify(result),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    console.error('weekly-stats error:', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }
});

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function getThisMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function indexByDate(rows: any[]): Record<string, any> {
  return rows.reduce((acc, r) => { acc[r.date] = r; return acc; }, {} as Record<string, any>);
}

function groupByDate(rows: any[]): Record<string, any[]> {
  return rows.reduce((acc, r) => {
    acc[r.date] = acc[r.date] ?? [];
    acc[r.date].push(r);
    return acc;
  }, {} as Record<string, any[]>);
}
