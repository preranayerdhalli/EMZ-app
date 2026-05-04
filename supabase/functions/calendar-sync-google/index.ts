// Supabase Edge Function: calendar-sync-google
// Exchanges an OAuth auth code for tokens (first sync) OR uses stored tokens
// for incremental sync via Google Calendar API nextSyncToken.
//
// POST body: { authCode?: string, date?: string }
//   - authCode: present on first connect; absent on subsequent syncs
//   - date: optional YYYY-MM-DD to sync a specific day (defaults to ±7 days)
//
// Deploy: supabase functions deploy calendar-sync-google

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3';

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

    const body = await req.json() as {
      serverAuthCode?: string; // from native GoogleSignin SDK (preferred — no redirect URI needed)
      authCode?: string;       // legacy expo-auth-session flow
      codeVerifier?: string;
      clientId?: string;
      redirectUri?: string;
    };

    let accessToken: string;
    let refreshToken: string | undefined;
    let syncToken: string | undefined;

    // ── Step 1: Get or refresh access token ───────────────────────────────────
    const { data: tokenRow } = await supabase
      .from('calendar_tokens')
      .select('access_token_enc, refresh_token_enc, expires_at, sync_token')
      .eq('user_id', user.id)
      .eq('provider', 'google')
      .single();

    if (body.serverAuthCode) {
      // Native Google Sign-In server auth code — server-side exchange, no redirect URI needed.
      // Requires GOOGLE_CLIENT_ID (web client) and GOOGLE_CLIENT_SECRET set in edge function env.
      const clientId = Deno.env.get('GOOGLE_CLIENT_ID')!;
      const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!;

      const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: body.serverAuthCode,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: '',
          grant_type: 'authorization_code',
        }),
      });
      const tokenData = await tokenRes.json();
      if (tokenData.error) throw new Error(`Google OAuth error: ${tokenData.error_description}`);

      accessToken  = tokenData.access_token;
      refreshToken = tokenData.refresh_token;

      await supabase.from('calendar_tokens').upsert({
        user_id: user.id,
        provider: 'google',
        access_token_enc: new TextEncoder().encode(accessToken),
        refresh_token_enc: refreshToken ? new TextEncoder().encode(refreshToken) : null,
        expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
        scope: tokenData.scope,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,provider' });

    } else if (body.authCode) {
      // Legacy expo-auth-session PKCE flow (kept for backwards compatibility)
      const clientId = body.clientId
        ?? Deno.env.get('GOOGLE_CLIENT_ID_IOS')
        ?? Deno.env.get('GOOGLE_CLIENT_ID')!;

      const params: Record<string, string> = {
        code: body.authCode,
        client_id: clientId,
        redirect_uri: body.redirectUri ?? 'emz://oauth2redirect',
        grant_type: 'authorization_code',
      };

      if (body.codeVerifier) {
        params.code_verifier = body.codeVerifier;
      } else {
        const secret = Deno.env.get('GOOGLE_CLIENT_SECRET');
        if (secret) params.client_secret = secret;
      }

      const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params),
      });
      const tokenData = await tokenRes.json();
      if (tokenData.error) throw new Error(`Google OAuth error: ${tokenData.error_description}`);

      accessToken  = tokenData.access_token;
      refreshToken = tokenData.refresh_token;

      // Store tokens (plaintext for MVP — encrypt in Phase 8)
      await supabase.from('calendar_tokens').upsert({
        user_id: user.id,
        provider: 'google',
        access_token_enc: new TextEncoder().encode(accessToken),
        refresh_token_enc: refreshToken ? new TextEncoder().encode(refreshToken) : null,
        expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
        scope: tokenData.scope,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,provider' });

    } else if (tokenRow) {
      // Subsequent sync — check token freshness and refresh if needed
      const expired = tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date();

      if (expired && tokenRow.refresh_token_enc) {
        const storedRefresh = new TextDecoder().decode(new Uint8Array(tokenRow.refresh_token_enc));
        const refreshClientId = body.clientId
          ?? Deno.env.get('GOOGLE_CLIENT_ID_IOS')
          ?? Deno.env.get('GOOGLE_CLIENT_ID')!;

        const refreshParams: Record<string, string> = {
          refresh_token: storedRefresh,
          client_id: refreshClientId,
          grant_type: 'refresh_token',
        };
        const secret = Deno.env.get('GOOGLE_CLIENT_SECRET');
        if (secret) refreshParams.client_secret = secret;

        const refreshRes = await fetch(GOOGLE_TOKEN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(refreshParams),
        });
        const refreshData = await refreshRes.json();
        if (refreshData.error) throw new Error(`Token refresh error: ${refreshData.error_description}`);

        accessToken = refreshData.access_token;
        await supabase.from('calendar_tokens')
          .update({
            access_token_enc: new TextEncoder().encode(accessToken),
            expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)
          .eq('provider', 'google');
      } else {
        accessToken = new TextDecoder().decode(new Uint8Array(tokenRow.access_token_enc));
      }

      syncToken = tokenRow.sync_token ?? undefined;
    } else {
      return new Response(
        JSON.stringify({ error: 'No Google Calendar connected. Provide authCode to connect.' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    }

    // ── Step 2: Fetch events from Google Calendar ─────────────────────────────
    const { data: userProfile } = await supabase
      .from('users')
      .select('timezone')
      .eq('id', user.id)
      .single();
    const tz = userProfile?.timezone ?? 'UTC';

    let eventsUrl: string;
    if (syncToken) {
      // Incremental sync — only changed events since last sync
      eventsUrl = `${GOOGLE_CALENDAR_BASE}/calendars/primary/events?syncToken=${syncToken}&singleEvents=true`;
    } else {
      // Full sync for next 14 days
      const timeMin = new Date();
      timeMin.setDate(timeMin.getDate() - 7);
      const timeMax = new Date();
      timeMax.setDate(timeMax.getDate() + 14);

      eventsUrl = `${GOOGLE_CALENDAR_BASE}/calendars/primary/events?` +
        `timeMin=${timeMin.toISOString()}&timeMax=${timeMax.toISOString()}` +
        `&singleEvents=true&orderBy=startTime&maxResults=500`;
    }

    const eventsRes = await fetch(eventsUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (eventsRes.status === 410) {
      // Sync token expired — need full re-sync (clear token and retry next call)
      await supabase.from('calendar_tokens')
        .update({ sync_token: null })
        .eq('user_id', user.id)
        .eq('provider', 'google');
      return new Response(
        JSON.stringify({ error: 'sync_token_expired', message: 'Call again without syncToken to do full resync' }),
        { status: 409, headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    }

    const eventsData = await eventsRes.json();
    const nextSyncToken: string | undefined = eventsData.nextSyncToken;

    // ── Step 3: Upsert events ─────────────────────────────────────────────────
    const upsertRows: any[] = [];

    for (const item of (eventsData.items ?? [])) {
      if (item.status === 'cancelled') {
        // Mark as deleted (don't remove — keeps reference for energy recalculation)
        upsertRows.push({
          user_id: user.id,
          external_id: item.id,
          source: 'google',
          title: item.summary ?? '(deleted)',
          start_at: new Date().toISOString(),
          end_at: new Date().toISOString(),
          date: new Date().toISOString().slice(0, 10),
          start_minutes: 0,
          end_minutes: 0,
          is_all_day: false,
          is_deleted: true,
          updated_at: new Date().toISOString(),
        });
        continue;
      }

      const isAllDay = Boolean(item.start?.date && !item.start?.dateTime);

      const startDt = new Date(item.start?.dateTime ?? item.start?.date ?? new Date());
      const endDt   = new Date(item.end?.dateTime ?? item.end?.date ?? new Date());
      const localDate = toLocalDate(startDt, tz);

      upsertRows.push({
        user_id: user.id,
        external_id: item.id,
        source: 'google',
        title: item.summary ?? '(no title)',
        start_at: startDt.toISOString(),
        end_at: endDt.toISOString(),
        date: localDate,
        start_minutes: timeToMinutes(startDt, tz),
        end_minutes: timeToMinutes(endDt, tz),
        is_all_day: isAllDay,
        is_deleted: false,
        updated_at: new Date().toISOString(),
      });
    }

    if (upsertRows.length > 0) {
      const { error: upsertErr } = await supabase
        .from('calendar_events')
        .upsert(upsertRows, { onConflict: 'user_id,source,external_id' });
      if (upsertErr) throw upsertErr;
    }

    // Save new sync token for next incremental sync
    if (nextSyncToken) {
      await supabase.from('calendar_tokens')
        .update({ sync_token: nextSyncToken, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('provider', 'google');
    }

    return new Response(
      JSON.stringify({ success: true, events_synced: upsertRows.length }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    console.error('calendar-sync-google error:', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }
});

// ── Time helpers ──────────────────────────────────────────────────────────────

function toLocalDate(date: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(date);
}

function timeToMinutes(date: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: false,
  }).formatToParts(date);
  const h = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0');
  const m = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0');
  return h * 60 + m;
}
