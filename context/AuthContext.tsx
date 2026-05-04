import { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as WebBrowser from 'expo-web-browser';
import { usePostHog } from 'posthog-react-native';
import { supabase } from '@/services/supabase';
import { initHealthSDK, signOutHealthSDK } from '@/services/health';

// Configure native Google Sign-In once at module load
// Auth-only config — no calendar scope here.
// Calendar access is requested separately when the user connects a calendar.
GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID!,
  // iosClientId is required for native iOS sign-in; without it the SDK
  // cannot determine which OAuth client to use and returns no idToken.
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS,
});

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signInWithEmail: (email: string) => Promise<void>;
  verifyOtp: (email: string, token: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const posthog = usePostHog();

  useEffect(() => {
    // Load existing session on mount
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    // Listen for auth state changes (magic link, OAuth callback)
    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === 'SIGNED_IN' && newSession?.user) {
        posthog?.identify(newSession.user.id, { email: newSession.user.email });
        posthog?.capture('signed_in', { provider: newSession.user.app_metadata?.provider ?? 'email' });
        initHealthSDK(newSession.user.id).catch(() => {});
      }
      if (event === 'SIGNED_OUT') {
        posthog?.reset();
        signOutHealthSDK();
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function signInWithEmail(email: string) {
    // Sends a 6-digit OTP code to the user's inbox.
    // We intentionally omit emailRedirectTo here: magic-link redirects to
    // custom URL schemes (emz://) are blocked by many mobile email clients
    // and browsers. The OTP code approach is fully reliable on mobile.
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: true },
    });
    if (error) throw error;
  }

  async function verifyOtp(email: string, token: string) {
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: token.trim(),
      type: 'email',
    });
    if (error) throw error;
  }

  async function signInWithGoogle() {
    // Uses native Google Sign-In sheet — no browser redirect, no redirect URI issues.
    // Requires a development build (not Expo Go) and the @react-native-google-signin plugin.
    await GoogleSignin.hasPlayServices();
    const response = await GoogleSignin.signIn();
    const idToken = response.data?.idToken;
    if (!idToken) throw new Error('No ID token returned from Google Sign-In');

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });
    if (error) throw error;
  }

  async function signInWithApple() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: 'emz://auth/callback', skipBrowserRedirect: true },
    });
    if (error) throw error;
    if (!data.url) return;
    const result = await WebBrowser.openAuthSessionAsync(data.url, 'emz://auth/callback');
    if (result.type === 'success' && result.url) {
      const codeMatch = result.url.match(/[?&]code=([^&]+)/);
      if (codeMatch) {
        await supabase.auth.exchangeCodeForSession(decodeURIComponent(codeMatch[1]));
      }
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    // Also sign out of native Google session so next sign-in shows account picker
    try { await GoogleSignin.signOut(); } catch { /* ignore */ }
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        signInWithEmail,
        verifyOtp,
        signInWithGoogle,
        signInWithApple,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
