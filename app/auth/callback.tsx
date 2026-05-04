import { View, ActivityIndicator } from 'react-native';
import { palette } from '@/constants/theme';

/**
 * Auth callback screen — shown briefly when the app is opened via
 * an emz://auth/callback deep link (magic link or OAuth redirect).
 *
 * The actual token/code exchange is handled by handleAuthUrl() in _layout.tsx.
 * Once the session is established, AuthGuard automatically navigates to
 * onboarding or the main app. This screen just provides a loading state
 * so Expo Router has a valid route to render in the meantime.
 */
export default function AuthCallbackScreen() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: palette.background,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ActivityIndicator color={palette.accentYellow} size="large" />
    </View>
  );
}
