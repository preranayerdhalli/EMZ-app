import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// expo-secure-store adapter so Supabase Auth tokens are stored encrypted on device
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ─── Database Types ────────────────────────────────────────────────────────────

export type WorkType =
  | 'deep' | 'creative' | 'admin' | 'chore' | 'recovery' | 'learning' | 'social';

export type Priority = 'high' | 'medium' | 'low';
export type EnergyLevel = 'high' | 'moderate' | 'low';
export type Chronotype = 'morning' | 'neutral' | 'evening';
export type CalendarProvider = 'google' | 'microsoft' | 'apple';
export type BiometricSource = 'healthkit' | 'health_connect' | 'manual';

export interface DBUser {
  id: string;
  email: string;
  timezone: string;
  chronotype: Chronotype;
  created_at: string;
}

export interface DBUserSettings {
  user_id: string;
  work_start_hour: number;
  work_end_hour: number;
  onboarding_complete: boolean;
  wearable_ios: string | null;
  wearable_android: string | null;
  updated_at: string;
}

export interface DBBiometricReading {
  id: string;
  user_id: string;
  date: string;                    // YYYY-MM-DD
  sleep_duration_min: number | null;
  sleep_efficiency: number | null;
  deep_sleep_pct: number | null;
  rem_sleep_pct: number | null;
  hrv_ms: number | null;
  hrv_7day_avg: number | null;
  resting_hr: number | null;
  recovery_score: number | null;
  body_battery_am: number | null;
  source: BiometricSource;
  created_at: string;
}

export interface DBEnergyForecast {
  id: string;
  user_id: string;
  date: string;
  hour: number;
  energy_level: EnergyLevel;
  suggested_work_type: WorkType;
  is_micro_break: boolean;
  base_score: number | null;
}

export interface DBCalendarEvent {
  id: string;
  user_id: string;
  external_id: string;
  source: CalendarProvider;
  title: string;
  start_at: string;
  end_at: string;
  date: string;
  start_minutes: number;
  end_minutes: number;
  is_all_day: boolean;
  is_deleted: boolean;
  updated_at: string;
}

export interface DBTask {
  id: string;
  user_id: string;
  title: string;
  work_type: WorkType;
  priority: Priority;
  date: string;
  start_minutes: number | null;
  end_minutes: number | null;
  duration_minutes: number;
  flexibility: 'today' | 'this_week' | 'flexible' | 'specific';
  is_recovery: boolean;
  completed: boolean;
  repeat_enabled: boolean;
  repeat_days: number[] | null;
  repeat_end_date: string | null;
  is_procrastinated: boolean;
  created_at: string;
  updated_at: string;
}

export interface DBSubtask {
  id: string;
  task_id: string;
  title: string;
  duration_minutes: number;
  completed: boolean;
  sort_order: number;
}

export interface DBMoodCheckin {
  id: string;
  user_id: string;
  date: string;
  checked_at: string;
  mood_emoji: string | null;
  mood_score: number | null;
  notes: string | null;
  voice_transcript: string | null;
  energy_impact: number | null;
}

export interface DBDailySummary {
  user_id: string;
  date: string;
  summary_text: string;
  capacity_score: number | null;
  task_count: number | null;
  meeting_minutes: number | null;
  mood_score: number | null;
  recommendations_json: Array<{ type: string; text: string }> | null;
  generated_at: string;
}

// ─── Typed helpers ─────────────────────────────────────────────────────────────

export const db = {
  users: () => supabase.from('users'),
  userSettings: () => supabase.from('user_settings'),
  biometricReadings: () => supabase.from('biometric_readings'),
  energyForecasts: () => supabase.from('energy_forecasts'),
  calendarTokens: () => supabase.from('calendar_tokens'),
  calendarEvents: () => supabase.from('calendar_events'),
  tasks: () => supabase.from('tasks'),
  subtasks: () => supabase.from('subtasks'),
  moodCheckins: () => supabase.from('mood_checkins'),
  dailySummaries: () => supabase.from('daily_summaries'),
};

// ─── Edge function invoker ─────────────────────────────────────────────────────

export async function invokeFunction<T = unknown>(
  name: string,
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body });
  if (error) throw error;
  return data as T;
}
