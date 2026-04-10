// Supabase Edge Function: calendar-sync-microsoft
// Microsoft Graph Calendar sync using delta queries for incremental updates.
//
// POST body: { authCode?: string, redirectUri?: string }
//
// Deploy: supabase functions deploy calendar-sync-microsoft

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MS_TOKEN_URL = `https://login.microsoftonline.com/common/oauth2/v2.0/token`;
const MS_GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

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

    const body = await req.json() as { authCode?: string; redirectUri?: string };

    let accessToken: string;

    const { data: tokenRow } = await supabase
      .from('calendar_tokens')
      .select('access_token_enc, refresh_token_enc, expires_at, delta_link')
      .eq('user_id', user.id)
      .eq('provider', 'microsoft')
      .single();

    if (body.authCode) {
      // First connect — exchange auth code for tokens
      const tokenRes = await fetch(MS_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: body.authCode,
          client_id: Deno.env.get('MICROSOFT_CLIENT_ID')!,
          client_secret: Deno.env.get('MICROSOFT_CLIENT_SECRET')!,
          redirect_uri: body.redirectUri ?? 'msauth.com.emz.app://auth',
          grant_type: 'authorization_code',
          scope: 'openid email offline_access Calendars.ReadWrite',
        }),
      });
      const tokenData = await tokenRes.json();
      if (tokenData.error) throw new Error(`Microsoft OAuth error: ${tokenData.error_description}`);

      accessToken = tokenData.access_token;
      await supabase.from('calendar_tokens').upsert({
        user_id: user.id,
        provider: 'microsoft',
        access_token_enc: new TextEncoder().encode(accessToken),
        refresh_token_enc: tokenData.refresh_token
          ? new TextEncoder().encode(tokenData.refresh_token) : null,
        expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
        scope: tokenData.scope,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,provider' });

    } else if (tokenRow) {
      const expired = tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date();

      if (expired && tokenRow.refresh_token_enc) {
        const storedRefresh = new TextDecoder().decode(new Uint8Array(tokenRow.refresh_token_enc));
        const refreshRes = await fetch(MS_TOKEN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            refresh_token: storedRefresh,
            client_id: Deno.env.get('MICROSOFT_CLIENT_ID')!,
            client_secret: Deno.env.get('MICROSOFT_CLIENT_SECRET')!,
            grant_type: 'refresh_token',
            scope: 'openid email offline_access Calendars.ReadWrite',
          }),
        });
        const refreshData = await refreshRes.json();
        if (refreshData.error) throw new Error(`Token refresh error: ${refreshData.error_description}`);
        accessToken = refreshData.access_token;
        await supabase.from('calendar_tokens')
          .update({
            access_token_enc: new TextEncoder().encode(accessToken),
            expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
          })
          .eq('user_id', user.id).eq('provider', 'microsoft');
      } else {
        accessToken = new TextDecoder().decode(new Uint8Array(tokenRow.access_token_enc));
      }
    } else {
      return new Response(
        JSON.stringify({ error: 'No Microsoft Calendar connected. Provide authCode to connect.' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    }

    // ── Fetch events via delta query ──────────────────────────────────────────
    const { data: userProfile } = await supabase
      .from('users').select('timezone').eq('id', user.id).single();
    const tz = userProfile?.timezone ?? 'UTC';

    let eventsUrl: string;
    if (tokenRow?.delta_link) {
      eventsUrl = tokenRow.delta_link;
    } else {
      const timeMin = new Date();
      timeMin.setDate(timeMin.getDate() - 7);
      const timeMax = new Date();
      timeMax.setDate(timeMax.getDate() + 14);
      eventsUrl = `${MS_GRAPH_BASE}/me/calendarView/delta` +
        `?startDateTime=${timeMin.toISOString()}&endDateTime=${timeMax.toISOString()}`;
    }

    const eventsRes = await fetch(eventsUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Prefer': `outlook.timezone="${tz}"`,
      },
    });
    const eventsData = await eventsRes.json();
    const nextDeltaLink: string | undefined = eventsData['@odata.deltaLink'];

    const upsertRows: any[] = [];

    for (const item of (eventsData.value ?? [])) {
      const isDeleted = item['@removed'] != null;
      const isAllDay  = Boolean(item.isAllDay);

      const startDt = new Date(item.start?.dateTime ?? new Date());
      const endDt   = new Date(item.end?.dateTime ?? new Date());
      const localDate = startDt.toISOString().slice(0, 10);

      upsertRows.push({
        user_id: user.id,
        external_id: item.id,
        source: 'microsoft',
        title: item.subject ?? '(no title)',
        start_at: startDt.toISOString(),
        end_at: endDt.toISOString(),
        date: localDate,
        start_minutes: isDeleted ? 0 : startDt.getHours() * 60 + startDt.getMinutes(),
        end_minutes: isDeleted ? 0 : endDt.getHours() * 60 + endDt.getMinutes(),
        is_all_day: isAllDay,
        is_deleted: isDeleted,
        updated_at: new Date().toISOString(),
      });
    }

    if (upsertRows.length > 0) {
      const { error: upsertErr } = await supabase
        .from('calendar_events')
        .upsert(upsertRows, { onConflict: 'user_id,source,external_id' });
      if (upsertErr) throw upsertErr;
    }

    if (nextDeltaLink) {
      await supabase.from('calendar_tokens')
        .update({ delta_link: nextDeltaLink, updated_at: new Date().toISOString() })
        .eq('user_id', user.id).eq('provider', 'microsoft');
    }

    return new Response(
      JSON.stringify({ success: true, events_synced: upsertRows.length }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    console.error('calendar-sync-microsoft error:', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }
});
