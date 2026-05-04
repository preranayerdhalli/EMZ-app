/**
 * services/health.ts
 *
 * Health data sync via Open Wearables SDK.
 * Replaces the previous react-native-health (HealthKit), react-native-health-connect,
 * and Samsung Health Sensor SDK integrations.
 *
 * Architecture:
 *   Open Wearables SDK ─► OW Server (Docker) ─► Supabase health-sync
 *
 * Required env vars:
 *   EXPO_PUBLIC_OW_HOST     — base URL of your OW server, e.g. https://ow.yourapp.com
 *   EXPO_PUBLIC_OW_API_KEY  — API key created in the OW developer portal
 *
 * Android prerequisite: publish the OW Android SDK to Maven Local before building:
 *   git clone https://github.com/the-momentum/open_wearables_android_sdk
 *   cd open_wearables_android_sdk && git checkout v0.6.0
 *   ./gradlew publishToMavenLocal
 *
 * Requires a dev build (expo prebuild + expo run:ios / run:android).
 */

import OpenWearablesSDK, { HealthDataType } from 'open-wearables';
import { Platform } from 'react-native';
import { supabase } from '@/services/supabase';

const OW_HOST = process.env.EXPO_PUBLIC_OW_HOST ?? '';
const OW_API_KEY = process.env.EXPO_PUBLIC_OW_API_KEY ?? '';

// Configure SDK once at module load — safe to call before sign-in
OpenWearablesSDK.configure(OW_HOST);

const HEALTH_TYPES: HealthDataType[] = [
  HealthDataType.HeartRateVariabilitySDNN,
  HealthDataType.RestingHeartRate,
  HealthDataType.OxygenSaturation,
  HealthDataType.Sleep,
  HealthDataType.MenstrualFlow,
];

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Call after Supabase sign-in. Signs the OW SDK in and requests health permissions.
 * Safe to call multiple times — OW SDK is a no-op if already signed in.
 */
export async function initHealthSDK(userId: string): Promise<void> {
  try {
    await OpenWearablesSDK.signIn(userId, null, null, OW_API_KEY);
    await OpenWearablesSDK.requestAuthorization(HEALTH_TYPES);
  } catch (err) {
    console.warn('[health] initHealthSDK failed:', err);
  }
}

/**
 * Trigger an immediate sync: OW SDK reads from HealthKit / Health Connect /
 * Samsung Health and pushes to the OW server, then we forward the daily
 * summary to the Supabase health-sync edge function.
 *
 * Safe to call on foreground — non-throwing.
 */
export async function syncHealthData(): Promise<void> {
  try {
    if (!OpenWearablesSDK.isSessionValid()) return;
    await OpenWearablesSDK.syncNow();
    await forwardOWDataToSupabase();
  } catch (err) {
    console.warn('[health] syncHealthData failed:', err);
  }
}

/**
 * Start native background sync (Android WorkManager / iOS BGTask).
 * Call once at app startup after initHealthSDK().
 */
export async function startHealthBackgroundSync(): Promise<void> {
  try {
    if (!OpenWearablesSDK.isSessionValid()) return;
    await OpenWearablesSDK.startBackgroundSync(7); // sync up to 7 days back
  } catch (err) {
    console.warn('[health] startBackgroundSync failed:', err);
  }
}

/**
 * Call on Supabase sign-out to clear the OW SDK session.
 */
export function signOutHealthSDK(): void {
  OpenWearablesSDK.signOut().catch(() => {});
}

// ─── OW server → Supabase forwarding ─────────────────────────────────────────

async function forwardOWDataToSupabase(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

  for (const date of [yesterday, today]) {
    const payload = await fetchOWDailySummary(date, session.user.id);
    if (payload) await postHealthSync({ ...payload, date });
  }
}

async function fetchOWDailySummary(
  date: string,
  userId: string,
): Promise<Record<string, unknown> | null> {
  if (!OW_HOST || !OW_API_KEY) return null;

  const headers = { 'X-Open-Wearables-API-Key': OW_API_KEY };

  const [recovery, sleep] = await Promise.all([
    owGet<{ items: OWRecoverySummary[] }>(
      `${OW_HOST}/api/v1/users/${userId}/summaries/recovery?start_date=${date}&end_date=${date}`,
      headers,
    ),
    owGet<{ items: OWSleepSummary[] }>(
      `${OW_HOST}/api/v1/users/${userId}/summaries/sleep?start_date=${date}&end_date=${date}`,
      headers,
    ),
  ]);

  const r = recovery?.items?.[0];
  const s = sleep?.items?.[0];
  if (!r && !s) return null;

  const stages = s?.stages as Record<string, number> | undefined;

  return {
    hrv_ms:             r?.avg_hrv_sdnn_ms ?? null,
    resting_hr:         r?.resting_heart_rate_bpm ?? null,
    spo2:               r?.avg_spo2_percent ?? s?.avg_spo2_percent ?? null,
    sleep_duration_min: s?.duration_minutes ?? null,
    sleep_efficiency:   s?.efficiency_percent ?? null,
    deep_sleep_pct:     stages?.deep != null ? stages.deep / (s!.duration_minutes! * 60) * 100 : null,
    rem_sleep_pct:      stages?.rem  != null ? stages.rem  / (s!.duration_minutes! * 60) * 100 : null,
    source:             (Platform.OS === 'ios' ? 'healthkit' : 'health_connect') as 'healthkit' | 'health_connect',
  };
}

async function owGet<T>(url: string, headers: Record<string, string>): Promise<T | null> {
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

interface OWRecoverySummary {
  date: string;
  resting_heart_rate_bpm?: number;
  avg_hrv_sdnn_ms?: number;
  avg_spo2_percent?: number;
  recovery_score?: number;
}

interface OWSleepSummary {
  date: string;
  duration_minutes?: number;
  efficiency_percent?: number;
  stages?: unknown;
  avg_hrv_sdnn_ms?: number;
  avg_spo2_percent?: number;
}

async function postHealthSync(payload: Record<string, unknown>): Promise<void> {
  const hasData = Object.entries(payload).some(
    ([k, v]) => k !== 'date' && k !== 'source' && v != null,
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
    throw new Error(`health-sync failed: ${await res.text()}`);
  }
}
