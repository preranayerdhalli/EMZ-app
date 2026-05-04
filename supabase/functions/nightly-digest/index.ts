// Supabase Edge Function: nightly-digest
// Called by pg_cron at 9 pm UTC every day via net.http_post.
// Uses the service role key — no per-user auth required.
// Generates daily_summaries rows for every user who has biometric data
// or a mood check-in for today.
//
// Deploy: supabase functions deploy nightly-digest

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  // Only accept calls that present the service role key.
  // pg_cron sends it in the Authorization header (see migration 008).
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const auth = req.headers.get('Authorization') ?? '';
  if (auth !== `Bearer ${serviceRoleKey}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    serviceRoleKey,
    { auth: { persistSession: false } },
  );

  const today = new Date().toISOString().slice(0, 10);

  // Find every user that has data for today (bio or mood).
  const [bioRes, moodRes] = await Promise.all([
    supabase.from('biometric_readings').select('user_id').eq('date', today),
    supabase.from('mood_checkins').select('user_id').eq('date', today),
  ]);

  const userIds = [
    ...new Set([
      ...(bioRes.data ?? []).map((r: any) => r.user_id),
      ...(moodRes.data ?? []).map((r: any) => r.user_id),
    ]),
  ] as string[];

  if (userIds.length === 0) {
    return new Response(JSON.stringify({ processed: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Run summary generation for each user concurrently.
  const results = await Promise.allSettled(userIds.map((uid) => generateSummary(supabase, uid, today)));

  const succeeded = results.filter((r) => r.status === 'fulfilled').length;
  const failed    = results.filter((r) => r.status === 'rejected').length;

  console.log(`nightly-digest ${today}: ${succeeded} ok, ${failed} failed`);

  return new Response(
    JSON.stringify({ date: today, processed: userIds.length, succeeded, failed }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});

// ─── Per-user summary generation ─────────────────────────────────────────────
// Mirrors the logic in daily-summary/index.ts — if you update either, update both.

async function generateSummary(supabase: any, userId: string, date: string): Promise<void> {
  const [bioRes, energyRes, moodRes, taskRes, eventRes] = await Promise.all([
    supabase.from('biometric_readings').select('*').eq('user_id', userId).eq('date', date).single(),
    supabase.from('energy_forecasts').select('energy_level, hour').eq('user_id', userId).eq('date', date),
    supabase.from('mood_checkins').select('mood_score, notes').eq('user_id', userId).eq('date', date),
    supabase.from('tasks').select('id, completed').eq('user_id', userId).eq('date', date),
    supabase.from('calendar_events').select('start_minutes, end_minutes').eq('user_id', userId).eq('date', date).eq('is_deleted', false),
  ]);

  const bio    = bioRes.data;
  const energy = energyRes.data ?? [];
  const moods  = moodRes.data ?? [];
  const tasks  = taskRes.data ?? [];
  const events = eventRes.data ?? [];

  const biometricBase = computeBiometricBase(bio);

  const moodScores = moods.map((m: any) => m.mood_score ?? 3.5);
  const avgMoodRaw = moodScores.length > 0
    ? moodScores.reduce((a: number, b: number) => a + b, 0) / moodScores.length
    : 3.5;
  const avgMoodNorm   = (avgMoodRaw - 1) / 5;
  const allNotes      = moods.map((m: any) => m.notes ?? '').join(' ');
  const keywordImpact = computeMoodKeywordImpact(allNotes);
  const capacityScore = clamp(biometricBase * 0.70 + avgMoodNorm * 0.20 + keywordImpact * 0.10, 0, 1);

  const highHours = energy
    .filter((e: any) => e.energy_level === 'high')
    .map((e: any) => e.hour as number)
    .sort((a: number, b: number) => a - b);
  const lowHours = energy
    .filter((e: any) => e.energy_level === 'low')
    .map((e: any) => e.hour as number);

  const peakStart = highHours.length > 0 ? fmtHour(highHours[0]) : '9am';
  const peakEnd   = highHours.length > 0 ? fmtHour(highHours[highHours.length - 1] + 1) : '11am';
  const dipHour   = lowHours.length > 0 ? fmtHour(Math.min(...lowHours)) : '2pm';

  const taskCount      = tasks.length;
  const completedCount = tasks.filter((t: any) => t.completed).length;
  const meetingMinutes = events.reduce((s: number, e: any) => s + (e.end_minutes - e.start_minutes), 0);
  const capacityCount  = Math.max(1, Math.round(taskCount * capacityScore));

  const summaryText     = buildSummary({ capacityScore, peakStart, peakEnd, dipHour, capacityCount, keywordImpact, meetingMinutes, taskCount });
  const recommendations = buildRecommendations({ capacityScore, meetingMinutes, taskCount, completedCount });

  const { error } = await supabase.from('daily_summaries').upsert({
    user_id: userId,
    date,
    summary_text: summaryText,
    capacity_score: Math.round(capacityScore * 1000) / 1000,
    task_count: taskCount,
    meeting_minutes: meetingMinutes,
    mood_score: Math.round(avgMoodNorm * 1000) / 1000,
    recommendations_json: recommendations,
    generated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,date' });

  if (error) throw error;
}

// ─── Shared helpers (mirrored from daily-summary) ────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function computeBiometricBase(bio: any): number {
  if (!bio) return 0.50;
  const sleepScore = clamp(
    ((bio.sleep_duration_min ?? 360) / 480) * 0.40 +
    ((bio.sleep_efficiency   ?? 75)  / 100) * 0.30 +
    ((bio.deep_sleep_pct     ?? 20)  / 25)  * 0.15 +
    ((bio.rem_sleep_pct      ?? 20)  / 25)  * 0.15,
    0, 1,
  );
  const hrv7        = bio.hrv_7day_avg ?? bio.hrv_ms ?? 50;
  const hrvRelative = hrv7 > 0 ? clamp((bio.hrv_ms ?? hrv7) / hrv7, 0.5, 1.5) : 1.0;
  const hrvScore    = clamp((hrvRelative - 0.5) / 1.0, 0, 1);
  return sleepScore * 0.45 + hrvScore * 0.35 + clamp((bio.recovery_score ?? 50) / 100, 0, 1) * 0.20;
}

const KEYWORD_IMPACT: Record<string, number> = {
  exhausted: -0.40, drained: -0.35, tired: -0.30, sluggish: -0.25,
  stressed: -0.25, anxious: -0.20, overwhelmed: -0.30, foggy: -0.20,
  meh: -0.10, okay: 0, fine: 0, alright: 0,
  good: +0.15, great: +0.25, amazing: +0.35, fantastic: +0.35,
  focused: +0.20, motivated: +0.25, energised: +0.30, energized: +0.30,
  rested: +0.25, refreshed: +0.20, calm: +0.10, ready: +0.15,
};

function computeMoodKeywordImpact(text: string): number {
  if (!text) return 0;
  const words = text.toLowerCase().split(/\W+/);
  const raw   = words.reduce((sum, w) => sum + (KEYWORD_IMPACT[w] ?? 0), 0);
  return clamp(raw / Math.max(words.length / 4, 1), -0.4, 0.4);
}

function fmtHour(h: number): string {
  const hour = ((h - 1) % 12) + 1;
  return h < 12 ? `${hour}am` : h === 12 ? '12pm' : `${hour}pm`;
}

function buildSummary(p: {
  capacityScore: number; peakStart: string; peakEnd: string; dipHour: string;
  capacityCount: number; keywordImpact: number; meetingMinutes: number; taskCount: number;
}): string {
  const meetingHours = Math.round(p.meetingMinutes / 60);
  const day = new Date().getDay();

  if (p.capacityScore >= 0.65) {
    const t = [
      `Strong recovery overnight. You're primed for deep work from ${p.peakStart} to ${p.peakEnd} — block that time now.`,
      `High energy day ahead. Your focus window runs ${p.peakStart}–${p.peakEnd}. Make the most of it before your energy curves down.`,
      `Your body is well recovered. Peak performance window: ${p.peakStart} to ${p.peakEnd}. ${meetingHours > 2 ? `Watch your ${meetingHours}h of meetings — protect at least one deep block.` : 'Good day to tackle your hardest task first.'}`,
    ];
    return t[day % t.length];
  }
  if (p.capacityScore >= 0.40) {
    const t = [
      `Solid recovery, though not peak. Protect your top ${p.capacityCount} ${p.capacityCount === 1 ? 'task' : 'tasks'} and take a break around ${p.dipHour}.`,
      `Your numbers are in a good range. Mix deep work with lighter admin around ${p.dipHour} when energy dips.`,
      `${meetingHours > 2 ? `You have ${meetingHours}h of meetings today — ` : ''}Aim for ${p.capacityCount} meaningful ${p.capacityCount === 1 ? 'task' : 'tasks'} and build in a midday break.`,
    ];
    return t[day % t.length];
  }
  const t = [
    `Your body is signalling a recovery day. Keep it to ${p.capacityCount} essential ${p.capacityCount === 1 ? 'task' : 'tasks'} and schedule a proper break at ${p.dipHour}.`,
    `Low recovery signals accumulated fatigue. Focus on essentials only and prioritise sleep tonight.`,
    `${p.keywordImpact < -0.2 ? 'You mentioned feeling drained — that matches your biometrics. ' : ''}Light day recommended. Protect your energy for tomorrow.`,
  ];
  return t[day % t.length];
}

function buildRecommendations(p: {
  capacityScore: number; meetingMinutes: number; taskCount: number; completedCount: number;
}): Array<{ type: string; text: string }> {
  const recs: Array<{ type: string; text: string }> = [];
  if (p.capacityScore < 0.45) {
    recs.push({ type: 'recovery', text: 'Schedule a 20-min break or breathing exercise mid-morning.' });
    recs.push({ type: 'sleep',    text: 'Aim for 8h sleep tonight to rebuild your HRV baseline.' });
  }
  if (p.meetingMinutes > 180) {
    recs.push({ type: 'schedule', text: 'Heavy meeting load today — batch admin tasks between calls.' });
  }
  if (p.taskCount - p.completedCount > 4) {
    recs.push({ type: 'focus', text: 'Pick your top 3 tasks and let the rest wait.' });
  }
  if (recs.length === 0) {
    recs.push({ type: 'positive', text: 'Great foundation today. Execute your plan and trust your preparation.' });
  }
  return recs;
}
