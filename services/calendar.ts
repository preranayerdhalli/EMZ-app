/**
 * services/calendar.ts
 *
 * Calendar integration:
 *  - Apple Calendar (EventKit via expo-calendar): reads device-local calendars, no OAuth
 *  - Google Calendar: OAuth 2.0 via expo-auth-session, then calls calendar-sync-google edge function
 *  - Microsoft Outlook: OAuth 2.0 via expo-auth-session, then calls calendar-sync-microsoft edge function
 */

import { Platform } from 'react-native';
import * as Calendar from 'expo-calendar';
import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { supabase } from '@/services/supabase';

// ─── Apple Calendar (EventKit) ────────────────────────────────────────────────

/**
 * Reads Apple Calendar events for a ±7 day window and syncs them
 * to the backend via the calendar-sync edge function (stored as source='apple').
 */
export async function syncAppleCalendar(): Promise<void> {
  if (Platform.OS !== 'ios') return;

  const { status } = await Calendar.requestCalendarPermissionsAsync();
  if (status !== 'granted') {
    console.log('Calendar permission denied.');
    return;
  }

  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  if (!calendars.length) return;

  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - 7);
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + 14);

  const events = await Calendar.getEventsAsync(
    calendars.map((c) => c.id),
    startDate,
    endDate,
  );

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const { data: userRow } = await supabase
    .from('users')
    .select('timezone')
    .eq('id', session.user.id)
    .single();
  const tz = (userRow as any)?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

  const upsertRows = events.map((e) => {
    const startDt = new Date(e.startDate);
    const endDt   = new Date(e.endDate ?? e.startDate);
    const localDate = toLocalDate(startDt, tz);
    return {
      user_id: session.user.id,
      external_id: e.id,
      source: 'apple',
      title: e.title ?? '(no title)',
      start_at: startDt.toISOString(),
      end_at: endDt.toISOString(),
      date: localDate,
      start_minutes: timeToMinutes(startDt, tz),
      end_minutes: timeToMinutes(endDt, tz),
      is_all_day: e.allDay ?? false,
      is_deleted: false,
      updated_at: new Date().toISOString(),
    };
  });

  if (upsertRows.length > 0) {
    await supabase
      .from('calendar_events')
      .upsert(upsertRows, { onConflict: 'user_id,source,external_id' });
  }
}

// ─── Google Calendar OAuth ────────────────────────────────────────────────────

/**
 * Connects Google Calendar using the native Google Sign-In SDK.
 *
 * GoogleSignin is already configured in AuthContext with offlineAccess: true
 * and the calendar.readonly scope. When a user signs in, Google issues a
 * serverAuthCode which the edge function exchanges server-side for tokens.
 * This avoids all redirect URI issues — no URI registration in Google Console needed.
 */
export async function connectGoogleCalendar(): Promise<boolean> {
  // Reconfigure with calendar scope + offlineAccess only here.
  // Auth sign-in (AuthContext) uses a minimal config with no calendar scope,
  // so users aren't prompted for calendar access just by signing in.
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID!,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS,
    scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
    offlineAccess: true,
  });

  let serverAuthCode: string | null = null;
  try {
    await GoogleSignin.hasPlayServices();
    const response = await GoogleSignin.signIn();
    serverAuthCode = response.data?.serverAuthCode ?? null;
  } catch {
    return false;
  }

  if (!serverAuthCode) return false;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return false;

  const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/calendar-sync-google`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ serverAuthCode }),
  });

  if (!res.ok) return false;

  // Immediately sync events so they appear without waiting for the background task
  await syncGoogleCalendar().catch(() => {});
  return true;
}

/**
 * Triggers an incremental Google Calendar sync (no auth code needed).
 */
export async function syncGoogleCalendar(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/calendar-sync-google`;
  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({}),
  });
}

// ─── Microsoft Calendar OAuth ─────────────────────────────────────────────────

const MS_CLIENT_ID = process.env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID!;
const MS_REDIRECT_URI = AuthSession.makeRedirectUri({ scheme: 'msauth.com.emz.app', path: 'auth' });

const MS_DISCOVERY = {
  authorizationEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
};

/**
 * Opens Microsoft OAuth consent screen and syncs Outlook calendar on success.
 */
export async function connectMicrosoftCalendar(): Promise<boolean> {
  const state = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    Math.random().toString(),
  );

  const request = new AuthSession.AuthRequest({
    clientId: MS_CLIENT_ID,
    scopes: ['openid', 'email', 'offline_access', 'Calendars.ReadWrite'],
    redirectUri: MS_REDIRECT_URI,
    responseType: AuthSession.ResponseType.Code,
    state,
    usePKCE: true,
  });

  await request.makeAuthUrlAsync(MS_DISCOVERY);
  const result = await request.promptAsync(MS_DISCOVERY);

  if (result.type !== 'success') return false;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return false;

  const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/calendar-sync-microsoft`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      authCode: result.params.code,
      codeVerifier: request.codeVerifier,
      redirectUri: MS_REDIRECT_URI,
    }),
  });

  return res.ok;
}

export async function syncMicrosoftCalendar(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/calendar-sync-microsoft`;
  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({}),
  });
}

// ─── Disconnect a calendar ────────────────────────────────────────────────────

export async function disconnectCalendar(
  provider: 'google' | 'microsoft' | 'apple',
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  await supabase
    .from('calendar_tokens')
    .delete()
    .eq('user_id', session.user.id)
    .eq('provider', provider);

  // Soft-delete all synced events from this provider
  await supabase
    .from('calendar_events')
    .update({ is_deleted: true })
    .eq('user_id', session.user.id)
    .eq('source', provider);
}

/** Check which calendars are currently connected */
export async function getConnectedCalendars(): Promise<Set<'google' | 'microsoft' | 'apple'>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return new Set();

  const { data } = await supabase
    .from('calendar_tokens')
    .select('provider')
    .eq('user_id', session.user.id);

  return new Set((data ?? []).map((r: any) => r.provider));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toLocalDate(date: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

function timeToMinutes(date: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: false,
  }).formatToParts(date);
  const h = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const m = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return h * 60 + m;
}
