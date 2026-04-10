import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import {
  Poppins_300Light,
  Poppins_400Regular,
  Poppins_500Medium,
} from '@expo-google-fonts/poppins';
import { View } from 'react-native';
import { palette } from '@/constants/theme';
import { AuthProvider } from '@/context/AuthContext';

// ─── To enable AG Book Rounded Bold ───────────────────────────────────────────
// 1. Place AGBookRounded-Bold.ttf (or .otf) in assets/fonts/
//    (woff2 works on web only; use ttf/otf for iOS and Android)
// 2. Uncomment the two lines below and add it to the useFonts map
//
// const AG_FONT = require('../assets/fonts/AGBookRounded-Bold.ttf');
// ─────────────────────────────────────────────────────────────────────────────

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    // 'AGBookRounded-Bold': AG_FONT,
    Poppins_300Light,
    Poppins_400Regular,
    Poppins_500Medium,
  });

  if (!fontsLoaded && !fontError) {
    return <View style={{ flex: 1, backgroundColor: palette.background }} />;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
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
  );
}
