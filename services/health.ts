/**
 * services/health.ts
 *
 * Reads biometric data from HealthKit (iOS) or Health Connect (Android)
 * and POSTs it to the health-sync edge function.
 *
 * IMPORTANT: This module requires a dev build (expo prebuild).
 *   Run: npx expo prebuild
 *   Then: npx expo run:ios  or  npx expo run:android
 *
 * Install packages (already done by npm install step):
 *   npm install react-native-health react-native-health-connect
 */

import { Platform } from 'react-native';
import { supabase } from '@/services/supabase';

// Lazy imports — these native modules only exist in dev builds
// Using dynamic require() to avoid crashes in Expo Go
function getHealthKit() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('react-native-health').default as typeof import('react-native-health').default;
}

function getHealthConnect() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('react-native-health-connect') as typeof import('react-native-health-connect');
}

// ─── iOS HealthKit permissions ────────────────────────────────────────────────

const IOS_PERMISSIONS = {
  permissions: {
    read: [
      'HeartRateVariabilitySDNN',   // HRV
      'RestingHeartRate',
      'SleepAnalysis',
      'MenstrualFlow',              // Period phase
      'AppleExerciseTime',
    ],
    write: [],
  },
};

// ─── Android Health Connect record types ──────────────────────────────────────

const ANDROID_RECORD_TYPES = [
  'SleepSessionRecord',
  'HeartRateVariabilityRmssdRecord',
  'RestingHeartRateRecord',
  'MenstruationFlowRecord',
  'ExerciseSessionRecord',
];

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Request health permissions and sync yesterday's + today's biometric data.
 * Safe to call on app foreground — deduped by the UNIQUE constraint on (user_id, date).
 */
export async function syncHealthData(): Promise<void> {
  try {
    if (Platform.OS === 'ios') {
      await syncIOS();
    } else if (Platform.OS === 'android') {
      await syncAndroid();
    }
  } catch (err) {
    // Non-critical: health sync failure shouldn't crash the app
    console.warn('Health sync failed:', err);
  }
}

// ─── iOS implementation ───────────────────────────────────────────────────────

async function syncIOS(): Promise<void> {
  let AppleHealthKit: ReturnType<typeof getHealthKit>;
  try {
    AppleHealthKit = getHealthKit();
  } catch {
    console.log('react-native-health not available (Expo Go). Skipping health sync.');
    return;
  }

  // Request permissions
  await new Promise<void>((resolve, reject) => {
    AppleHealthKit.initHealthKit(IOS_PERMISSIONS, (err: string) => {
      if (err) reject(new Error(err));
      else resolve();
    });
  });

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  for (const date of [yesterday, today]) {
    await syncIOSForDate(AppleHealthKit, date);
  }
}

async function syncIOSForDate(
  AppleHealthKit: ReturnType<typeof getHealthKit>,
  date: Date,
): Promise<void> {
  const dateStr = date.toISOString().slice(0, 10);
  const startDate = new Date(dateStr + 'T00:00:00.000Z').toISOString();
  const endDate   = new Date(dateStr + 'T23:59:59.999Z').toISOString();

  const options = { startDate, endDate, ascending: false, limit: 1 };

  // HRV (overnight average)
  const hrv = await readIOSSample<any[]>(
    AppleHealthKit,
    'getHeartRateVariabilitySamples',
    options,
  ).then((samples) => samples?.[0]?.value ?? null);

  // Resting HR
  const restingHr = await readIOSSample<any[]>(
    AppleHealthKit,
    'getRestingHeartRateSamples',
    options,
  ).then((samples) => samples?.[0]?.value ?? null);

  // Sleep (previous night — use a 36h window to catch both sides of midnight)
  const sleepStart = new Date(date);
  sleepStart.setDate(sleepStart.getDate() - 1);
  sleepStart.setHours(18, 0, 0, 0);

  const sleepData = await readIOSSample<any[]>(
    AppleHealthKit,
    'getSleepSamples',
    { startDate: sleepStart.toISOString(), endDate: endDate, ascending: true, limit: 50 },
  ).then((samples) => parseSleepSamplesIOS(samples ?? []));

  // Period flow
  const periodSamples = await readIOSSample<any[]>(
    AppleHealthKit,
    'getMenstrualFlowSamples',
    { ...options, limit: 5 },
  ).then((s) => s ?? []);
  const periodPhase = periodSamples.length > 0 ? inferPeriodPhaseFromFlow(periodSamples) : null;

  const payload = {
    date: dateStr,
    sleep_duration_min: sleepData.durationMin,
    sleep_efficiency: sleepData.efficiency,
    deep_sleep_pct: sleepData.deepPct,
    rem_sleep_pct: sleepData.remPct,
    hrv_ms: hrv,
    resting_hr: restingHr,
    period_phase: periodPhase,
    source: 'healthkit' as const,
  };

  await postHealthSync(payload);
}

function readIOSSample<T>(
  AppleHealthKit: ReturnType<typeof getHealthKit>,
  method: string,
  options: Record<string, unknown>,
): Promise<T | null> {
  return new Promise((resolve) => {
    const fn = (AppleHealthKit as any)[method];
    if (!fn) { resolve(null); return; }
    fn(options, (err: string, result: T) => {
      resolve(err ? null : result);
    });
  });
}

function parseSleepSamplesIOS(samples: any[]): {
  durationMin: number | null;
  efficiency: number | null;
  deepPct: number | null;
  remPct: number | null;
} {
  if (!samples.length) return { durationMin: null, efficiency: null, deepPct: null, remPct: null };

  let totalMin = 0, deepMin = 0, remMin = 0, awakeMin = 0;

  for (const s of samples) {
    const dur = (new Date(s.endDate).getTime() - new Date(s.startDate).getTime()) / 60000;
    const value = s.value?.toLowerCase() ?? '';
    if (value.includes('deep'))   { deepMin += dur; totalMin += dur; }
    else if (value.includes('rem')) { remMin += dur; totalMin += dur; }
    else if (value.includes('awake')) { awakeMin += dur; }
    else if (value.includes('asleep') || value.includes('core')) { totalMin += dur; }
  }

  if (totalMin === 0) return { durationMin: null, efficiency: null, deepPct: null, remPct: null };

  const efficiency = totalMin > 0 ? Math.round((totalMin / (totalMin + awakeMin)) * 100) : null;
  const deepPct    = Math.round((deepMin / totalMin) * 100);
  const remPct     = Math.round((remMin / totalMin) * 100);

  return {
    durationMin: Math.round(totalMin),
    efficiency,
    deepPct,
    remPct,
  };
}

function inferPeriodPhaseFromFlow(samples: any[]): string | null {
  // Apple Health menstrual flow: 1=none, 2=light, 3=medium, 4=heavy
  const latest = samples[samples.length - 1];
  const flowValue = latest?.value ?? 1;
  if (flowValue >= 2) return 'menstrual';
  // Without cycle day tracking, we can't infer other phases from flow alone
  return null;
}

// ─── Android Health Connect implementation ────────────────────────────────────

async function syncAndroid(): Promise<void> {
  let HealthConnect: ReturnType<typeof getHealthConnect>;
  try {
    HealthConnect = getHealthConnect();
  } catch {
    console.log('react-native-health-connect not available. Skipping health sync.');
    return;
  }

  const { isAvailable } = await HealthConnect.initialize();
  if (!isAvailable) { console.log('Health Connect not available on this device.'); return; }

  const granted = await HealthConnect.requestPermission(
    ANDROID_RECORD_TYPES.map((type) => ({ accessType: 'read', recordType: type })),
  );

  if (!granted) { console.log('Health Connect permissions denied.'); return; }

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  for (const date of [yesterday, today]) {
    await syncAndroidForDate(HealthConnect, date);
  }
}

async function syncAndroidForDate(
  HealthConnect: ReturnType<typeof getHealthConnect>,
  date: Date,
): Promise<void> {
  const dateStr = date.toISOString().slice(0, 10);
  const timeRangeFilter = {
    operator: 'between' as const,
    startTime: dateStr + 'T00:00:00Z',
    endTime: dateStr + 'T23:59:59Z',
  };

  const [hrvRecords, hrRecords, sleepRecords, periodRecords] = await Promise.all([
    HealthConnect.readRecords('HeartRateVariabilityRmssdRecord', { timeRangeFilter }).catch(() => ({ records: [] })),
    HealthConnect.readRecords('RestingHeartRateRecord', { timeRangeFilter }).catch(() => ({ records: [] })),
    HealthConnect.readRecords('SleepSessionRecord', { timeRangeFilter }).catch(() => ({ records: [] })),
    HealthConnect.readRecords('MenstruationFlowRecord', { timeRangeFilter }).catch(() => ({ records: [] })),
  ]);

  const latestHrv = (hrvRecords.records as any[])[0]?.heartRateVariabilityMillis ?? null;
  const latestHr  = (hrRecords.records as any[])[0]?.beatsPerMinute ?? null;
  const sleepData = parseAndroidSleep((sleepRecords.records as any[]) ?? []);
  const periodPhase = parsePeriodAndroid((periodRecords.records as any[]) ?? []);

  const payload = {
    date: dateStr,
    sleep_duration_min: sleepData.durationMin,
    sleep_efficiency: sleepData.efficiency,
    deep_sleep_pct: sleepData.deepPct,
    rem_sleep_pct: sleepData.remPct,
    hrv_ms: latestHrv,
    resting_hr: latestHr,
    period_phase: periodPhase,
    source: 'health_connect' as const,
  };

  await postHealthSync(payload);
}

function parseAndroidSleep(records: any[]): {
  durationMin: number | null;
  efficiency: number | null;
  deepPct: number | null;
  remPct: number | null;
} {
  if (!records.length) return { durationMin: null, efficiency: null, deepPct: null, remPct: null };

  let totalMin = 0, deepMin = 0, remMin = 0, awakeMin = 0;

  for (const session of records) {
    const sessionDur = (new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 60000;
    totalMin += sessionDur;

    for (const stage of (session.stages ?? [])) {
      const dur = (new Date(stage.endTime).getTime() - new Date(stage.startTime).getTime()) / 60000;
      // Health Connect sleep stage types: 1=AWAKE, 2=SLEEP_LIGHT, 3=SLEEP_DEEP, 4=SLEEP_REM, 5=SLEEP_UNKNOWN, 6=OUT_OF_BED
      if (stage.stage === 3)  deepMin += dur;
      if (stage.stage === 4)  remMin  += dur;
      if (stage.stage === 1 || stage.stage === 6)  awakeMin += dur;
    }
  }

  if (totalMin === 0) return { durationMin: null, efficiency: null, deepPct: null, remPct: null };

  const asleepMin  = totalMin - awakeMin;
  const efficiency = totalMin > 0 ? Math.round((asleepMin / totalMin) * 100) : null;

  return {
    durationMin: Math.round(asleepMin),
    efficiency,
    deepPct: asleepMin > 0 ? Math.round((deepMin / asleepMin) * 100) : null,
    remPct:  asleepMin > 0 ? Math.round((remMin / asleepMin) * 100) : null,
  };
}

function parsePeriodAndroid(records: any[]): string | null {
  if (!records.length) return null;
  const latest = records[records.length - 1];
  // Health Connect flow types: 0=UNKNOWN, 1=NONE, 2=LIGHT, 3=MEDIUM, 4=HEAVY
  return (latest.flow ?? 0) >= 2 ? 'menstrual' : null;
}

// ─── Shared POST helper ───────────────────────────────────────────────────────

async function postHealthSync(payload: Record<string, unknown>): Promise<void> {
  // Skip if all biometric values are null (no data available)
  const hasData = Object.entries(payload).some(([k, v]) =>
    k !== 'date' && k !== 'source' && v != null,
  );
  if (!hasData) return;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/health-sync`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`health-sync failed: ${err}`);
  }
}
