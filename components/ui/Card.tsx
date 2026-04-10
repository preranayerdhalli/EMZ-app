import { View, StyleSheet, type ViewProps, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, borderRadius, layout, cardShadow } from '@/constants/theme';

type Props = ViewProps & {
  variant?: 'card' | 'cardStrong' | 'sheet';
  inset?: boolean;
  style?: ViewStyle | ViewStyle[];
};

export function Card({ variant = 'card', inset = true, style, children, ...rest }: Props) {
  const gradientStart = variant === 'sheet'
    ? (['rgba(255,252,244,0.97)', 'rgba(255,252,244,0.97)'] as [string, string])
    : variant === 'cardStrong'
    ? (['rgba(255,255,255,0.98)', 'rgba(255,255,255,0.94)'] as [string, string])
    : (['rgba(255,255,255,0.92)', 'rgba(255,255,255,0.84)'] as [string, string]);

  const border =
    variant === 'sheet' ? colors.surface.sheetBorder : colors.surface.cardBorder;

  return (
    <View style={[styles.outer, { borderColor: border }, cardShadow, style]} {...rest}>
      <LinearGradient
        colors={gradientStart}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.inner, inset && styles.inset]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderRadius: borderRadius.card,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  inner: {
    borderRadius: borderRadius.card,
    backgroundColor: 'transparent',
  },
  inset: {
    padding: layout.cardPadding,
  },
});
