import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import {
  Poppins_300Light,
  Poppins_400Regular,
  Poppins_500Medium,
} from '@expo-google-fonts/poppins';
import { useEffect } from 'react';
import { View } from 'react-native';
import * as Linking from 'expo-linking';
import { PostHogProvider } from 'posthog-react-native';
import { palette } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { supabase, db } from '@/services/supabase';
import { registerBackgroundSync, subscribeToForegroundSync } from '@/services/backgroundSync';

// ─── To enable AG Book Rounded Bold ───────────────────────────────────────────
// 1. Place AGBookRounded-Bold.ttf (or .otf) in assets/fonts/
//    (woff2 works on web only; use ttf/otf for iOS and Android)
// 2. Uncomment the two lines below and add it to the useFonts map
//
// const AG_FONT = require('../assets/fonts/AGBookRounded-Bold.ttf');
// ─────────────────────────────────────────────────────────────────────────────

// Handles all session-driven navigation:
//  - After sign-in (Google, magic link, Apple): redirects from auth/callback screens
//    to onboarding or main app.
//  - After sign-out: redirects protected screens back to login.
function AuthGuard() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';
    // auth/callback route — shown while magic-link deep link is being processed
    const inCallback  = segments[0] === 'auth';
    const onStartup   = segments[0] === 'index' || segments[0] === undefined;

    if (session && (inAuthGroup || inCallback)) {
      // Just signed in — check onboarding and navigate into the app.
      db.userSettings()
        .select('onboarding_complete')
        .eq('user_id', session.user.id)
        .single()
        .then(({ data, error }) => {
          if (error || !data?.onboarding_complete) {
            router.replace('/onboarding');
          } else {
            router.replace('/(main-screens)');
          }
        });
      return;
    }

    if (session) return; // Already in the app — nothing to do.

    // No session — redirect to login if on a protected screen.
    if (inAuthGroup || inCallback || onStartup) return;
    router.replace('/(auth)/login');
  }, [session, loading, segments, router]);

  useEffect(() => {
    if (!session) return;
    registerBackgroundSync();
    const unsubscribe = subscribeToForegroundSync();
    return unsubscribe;
  }, [session]);

  return null;
}

async function handleAuthUrl(url: string) {
  if (!url.includes('auth/callback')) return;

  // PKCE flow (OAuth): URL contains ?code=...
  const codeMatch = url.match(/[?&]code=([^&]+)/);
  if (codeMatch) {
    await supabase.auth.exchangeCodeForSession(decodeURIComponent(codeMatch[1]));
    return;
  }

  // Implicit flow (magic link): URL contains #access_token=...&refresh_token=...
  const hash = url.split('#')[1] ?? '';
  const params = new URLSearchParams(hash);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (access_token && refresh_token) {
    await supabase.auth.setSession({ access_token, refresh_token });
  }
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    // 'AGBookRounded-Bold': AG_FONT,
    Poppins_300Light,
    Poppins_400Regular,
    Poppins_500Medium,
  });

  // Handle deep links: magic link emails + OAuth callbacks
  useEffect(() => {
    // Cold start: app was opened via deep link
    Linking.getInitialURL().then((url) => {
      if (url) handleAuthUrl(url);
    });

    // Warm start: app was already open when link was tapped
    const sub = Linking.addEventListener('url', ({ url }) => handleAuthUrl(url));
    return () => sub.remove();
  }, []);

  if (!fontsLoaded && !fontError) {
    return <View style={{ flex: 1, backgroundColor: palette.background }} />;
  }

  return (
    <PostHogProvider
      apiKey="phc_z22qR5og8mmaTcm7iDtMiEJvXAudcSkWMRH5x5BVBcwr"
      options={{ host: 'https://eu.i.posthog.com' }}
    >
      <SafeAreaProvider>
        <AuthProvider>
          <AuthGuard />
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(main-screens)" />
            <Stack.Screen
              name="music-player"
              options={{ presentation: 'modal', animation: 'slide_from_bottom', headerShown: false }}
            />
            <Stack.Screen
              name="box-breathing"
              options={{ presentation: 'modal', animation: 'slide_from_bottom', headerShown: false }}
            />
          </Stack>
        </AuthProvider>
      </SafeAreaProvider>
    </PostHogProvider>
  );
}
