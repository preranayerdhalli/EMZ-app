import { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/services/supabase';
import { palette } from '@/constants/theme';

export default function StartupGate() {
  const router = useRouter();
  const { session, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!session) {
      // No authenticated session → go to auth
      router.replace('/(auth)/login');
      return;
    }

    // Authenticated — check if onboarding is complete
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
  }, [session, loading]);

  return <View style={{ flex: 1, backgroundColor: palette.background }} />;
}
