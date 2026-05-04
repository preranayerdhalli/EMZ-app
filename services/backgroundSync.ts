/**
 * services/backgroundSync.ts
 *
 * Registers background and foreground sync behaviour.
 *
 * Background health sync is now handled natively by the Open Wearables SDK
 * (Android WorkManager / iOS BGTask) via startHealthBackgroundSync().
 *
 * This module handles:
 *   - Kicking off the OW background sync at startup
 *   - Triggering the Supabase daily-summary edge function on foreground resume
 */

import { AppState, AppStateStatus } from 'react-native';
import { syncHealthData, startHealthBackgroundSync } from '@/services/health';
import { invokeFunction } from '@/services/supabase';

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Call once at app startup (after initHealthSDK in AuthProvider).
 * Registers the OW SDK native background sync.
 */
export async function registerBackgroundSync(): Promise<void> {
  await startHealthBackgroundSync();
}

/**
 * Triggers a full sync + daily-summary refresh whenever the app comes
 * back to the foreground. Returns an unsubscribe function.
 */
export function subscribeToForegroundSync(): () => void {
  let lastSyncAt = 0;
  const DEBOUNCE_MS = 60 * 60 * 1000; // max once per hour

  const handleAppStateChange = async (nextState: AppStateStatus) => {
    if (nextState !== 'active') return;
    const now = Date.now();
    if (now - lastSyncAt < DEBOUNCE_MS) return;
    lastSyncAt = now;
    runSync().catch(() => {});
  };

  const sub = AppState.addEventListener('change', handleAppStateChange);
  return () => sub.remove();
}

// ─── Internal ─────────────────────────────────────────────────────────────────

async function runSync(): Promise<void> {
  await syncHealthData();
  const today = new Date().toISOString().slice(0, 10);
  await invokeFunction('daily-summary', { date: today });
}
