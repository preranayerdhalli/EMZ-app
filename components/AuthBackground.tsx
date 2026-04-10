import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { palette } from '@/constants/theme';

/**
 * App-wide background — warm parchment feel.
 * Gradient from #F4EFCF to #F2DEB0, barely noticeable, calm and premium.
 */
export function AuthBackground({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.container}>
      {/* Base: warm parchment — #F4EFCF → #F2DEB0 (135deg approximated) */}
      <LinearGradient
        colors={[palette.background, palette.backgroundSecondary]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Subtle top warmth — very soft, almost invisible */}
      <LinearGradient
        colors={['rgba(255, 217, 61, 0.06)', 'transparent']}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.3, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Bottom-left warm glow — soft gold/orange, low opacity */}
      <LinearGradient
        colors={[
          'transparent',
          'rgba(255, 182, 108, 0.12)',
          'rgba(255, 217, 61, 0.10)',
        ]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 0.4, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {children}
    </View>
  );
}

/** Re-export for use as app-wide background. */
export const AppBackground = AuthBackground;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
});
