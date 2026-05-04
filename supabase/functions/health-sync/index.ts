// Supabase Edge Function: health-sync
// Receives biometric payload from mobile app, upserts biometric_readings,
// then triggers energy-forecast computation for the date.
//
// Deploy: supabase functions deploy health-sync

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HealthPayload {
  date: string;               // YYYY-MM-DD
  sleep_duration_min?: number;
  sleep_efficiency?: number;  // 0-100
  deep_sleep_pct?: number;    // 0-100
  rem_sleep_pct?: number;     // 0-100
  hrv_ms?: number;
  resting_hr?: number;
  spo2?: number;              // blood oxygen saturation %
  skin_temperature?: number;  // surface temp in °C (Samsung sensor only)
  recovery_score?: number;    // 0-100
  body_battery_am?: number;   // 0-100
  period_phase?: 'follicular' | 'ovulatory' | 'luteal' | 'menstrual' | null;
  period_day?: number | null;
  source: 'healthkit' | 'health_connect' | 'samsung_sensor' | 'manual';
}

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

    // Verify user identity
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return new Response('Unauthorized', { status: 401, headers: CORS });

    const payload: HealthPayload = await req.json();

    // Compute rolling 7-day HRV average before upsert
    let hrv7DayAvg: number | null = null;
    if (payload.hrv_ms != null) {
      const sevenDaysAgo = new Date(payload.date);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: recent } = await supabase
        .from('biometric_readings')
        .select('hrv_ms')
        .eq('user_id', user.id)
        .gte('date', sevenDaysAgo.toISOString().slice(0, 10))
        .not('hrv_ms', 'is', null);

      if (recent && recent.length > 0) {
        const sum = recent.reduce((acc: number, r: any) => acc + (r.hrv_ms ?? 0), 0);
        hrv7DayAvg = sum / recent.length;
      } else {
        hrv7DayAvg = payload.hrv_ms; // Use today as baseline when no history
      }
    }

    // Encrypt period data using pgcrypto (key from Vault)
    // Note: encryption is done server-side via SQL function to keep key off edge function
    // For MVP: store as plaintext with strict RLS; add encryption in Phase 8
    const biometricRow = {
      user_id: user.id,
      date: payload.date,
      sleep_duration_min: payload.sleep_duration_min ?? null,
      sleep_efficiency: payload.sleep_efficiency ?? null,
      deep_sleep_pct: payload.deep_sleep_pct ?? null,
      rem_sleep_pct: payload.rem_sleep_pct ?? null,
      hrv_ms: payload.hrv_ms ?? null,
      hrv_7day_avg: hrv7DayAvg,
      resting_hr: payload.resting_hr ?? null,
      spo2: payload.spo2 ?? null,
      skin_temperature: payload.skin_temperature ?? null,
      recovery_score: payload.recovery_score ?? null,
      body_battery_am: payload.body_battery_am ?? null,
      source: payload.source,
    };

    const { error: upsertErr } = await supabase
      .from('biometric_readings')
      .upsert(biometricRow, { onConflict: 'user_id,date' });

    if (upsertErr) throw upsertErr;

    // Fetch user settings for energy algorithm inputs
    const { data: settings } = await supabase
      .from('user_settings')
      .select('work_start_hour, work_end_hour')
      .eq('user_id', user.id)
      .single();

    const { data: userProfile } = await supabase
      .from('users')
      .select('chronotype')
      .eq('id', user.id)
      .single();

    // Trigger energy forecast computation inline (avoids cold-start penalty of separate invocation)
    const forecasts = computeEnergyForecast({
      ...biometricRow,
      hrv_7day_avg: hrv7DayAvg,
      period_phase: payload.period_phase ?? null,
      chronotype: userProfile?.chronotype ?? 'neutral',
      work_start_hour: settings?.work_start_hour ?? 9,
      work_end_hour: settings?.work_end_hour ?? 18,
    });

    // Upsert all hourly forecasts for the day
    const forecastRows = forecasts.map((f) => ({
      user_id: user.id,
      date: payload.date,
      ...f,
    }));

    const { error: forecastErr } = await supabase
      .from('energy_forecasts')
      .upsert(forecastRows, { onConflict: 'user_id,date,hour' });

    if (forecastErr) throw forecastErr;

    return new Response(
      JSON.stringify({ success: true, forecasts_generated: forecastRows.length }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    console.error('health-sync error:', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }
});

// ─── Energy forecast algorithm ────────────────────────────────────────────────

type WorkType = 'deep' | 'creative' | 'admin' | 'chore' | 'recovery' | 'learning' | 'social';
type EnergyLevel = 'high' | 'moderate' | 'low';
type Chronotype = 'morning' | 'neutral' | 'evening';

interface BiometricInputs {
  sleep_duration_min: number | null;
  sleep_efficiency: number | null;
  deep_sleep_pct: number | null;
  rem_sleep_pct: number | null;
  hrv_ms: number | null;
  hrv_7day_avg: number | null;
  recovery_score: number | null;
  body_battery_am: number | null;
  period_phase: string | null;
  chronotype: Chronotype;
  work_start_hour: number;
  work_end_hour: number;
}

interface HourForecast {
  hour: number;
  energy_level: EnergyLevel;
  suggested_work_type: WorkType;
  is_micro_break: boolean;
  base_score: number;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function computeEnergyForecast(inputs: BiometricInputs): HourForecast[] {
  // ── Step 1: Base biometric score (0–1) ──────────────────────────────────────
  const sleepScore = clamp(
    ((inputs.sleep_duration_min ?? 360) / 480) * 0.40 +
    ((inputs.sleep_efficiency ?? 75) / 100) * 0.30 +
    ((inputs.deep_sleep_pct ?? 20) / 25) * 0.15 +
    ((inputs.rem_sleep_pct ?? 20) / 25) * 0.15,
    0, 1,
  );

  const hrv7 = inputs.hrv_7day_avg ?? inputs.hrv_ms ?? 50;
  const hrvRelative = hrv7 > 0 ? clamp((inputs.hrv_ms ?? hrv7) / hrv7, 0.5, 1.5) : 1.0;
  const hrvScore = clamp((hrvRelative - 0.5) / 1.0, 0, 1);

  const recoveryNorm = clamp((inputs.recovery_score ?? 50) / 100, 0, 1);
  const batteryNorm  = clamp((inputs.body_battery_am ?? 50) / 100, 0, 1);

  const baseScore = sleepScore * 0.35 + hrvScore * 0.30 + recoveryNorm * 0.25 + batteryNorm * 0.10;

  // ── Step 2: Period phase modifier ───────────────────────────────────────────
  const PERIOD_MOD: Record<string, number> = {
    follicular: +0.05,
    ovulatory:  +0.10,
    luteal:     -0.05,
    menstrual:  -0.15,
  };
  const periodAdj = inputs.period_phase ? (PERIOD_MOD[inputs.period_phase] ?? 0) : 0;
  const adjustedBase = clamp(baseScore + periodAdj, 0, 1);

  // ── Step 3: Chronotype peak hour (Horne-Östberg) ────────────────────────────
  const PEAK_HOUR: Record<Chronotype, number> = { morning: 9, neutral: 11, evening: 13 };
  const peak = PEAK_HOUR[inputs.chronotype];

  function chronotypeCurve(hour: number): number {
    const primaryPeak    = Math.exp(-0.5 * ((hour - peak) / 1.8) ** 2);
    const afternoonDip   = (hour >= 13 && hour <= 15) ? -0.18 : 0;
    const secondaryPeak  = Math.exp(-0.5 * ((hour - (peak + 6)) / 2.5) ** 2) * 0.55;
    return clamp(primaryPeak + secondaryPeak + afternoonDip, 0.05, 1.0);
  }

  // ── Step 4–6: Per-hour calculation ──────────────────────────────────────────
  const results: HourForecast[] = [];

  for (let hour = 7; hour <= 21; hour++) {
    const timeFactor = chronotypeCurve(hour);
    const rawScore   = adjustedBase * timeFactor;

    const energyLevel: EnergyLevel =
      rawScore > 0.60 ? 'high' :
      rawScore > 0.35 ? 'moderate' : 'low';

    // Ultradian rhythm micro-break: every 90-min block after work start
    const minsSinceStart = (hour - inputs.work_start_hour) * 60;
    const cyclePos       = minsSinceStart % 110; // 90min work + 20min rest
    const isMicroBreak   = cyclePos >= 90 && minsSinceStart > 0 && hour < inputs.work_end_hour;

    const suggestedWorkType = mapEnergyToWorkType(
      energyLevel,
      hour,
      peak,
      inputs.period_phase,
      isMicroBreak,
    );

    results.push({
      hour,
      energy_level: energyLevel,
      suggested_work_type: suggestedWorkType,
      is_micro_break: isMicroBreak,
      base_score: Math.round(rawScore * 1000) / 1000,
    });
  }

  return results;
}

function mapEnergyToWorkType(
  energy: EnergyLevel,
  hour: number,
  peak: number,
  periodPhase: string | null,
  isMicroBreak: boolean,
): WorkType {
  if (isMicroBreak) return 'recovery';

  if (energy === 'high') {
    return hour <= peak + 2 ? 'deep' : 'creative';
  }
  if (energy === 'moderate') {
    if (periodPhase === 'menstrual') return 'admin';
    return hour < 14 ? 'admin' : 'learning';
  }
  // Low energy
  return (hour >= 12 && hour <= 15) ? 'recovery' : 'chore';
}
