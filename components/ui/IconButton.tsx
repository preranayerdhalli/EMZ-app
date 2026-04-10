import { Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, borderRadius, layout } from '@/constants/theme';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
  tone?: 'neutral' | 'accent' | 'danger';
  size?: 'sm' | 'md';
  style?: ViewStyle;
};

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  tone = 'neutral',
  size = 'md',
  style,
}: Props) {
  const fg =
    tone === 'accent'
      ? colors.brandGold
      : tone === 'danger'
        ? colors.danger
        : colors.ink.primary;

  const dim = size === 'sm' ? 34 : 40;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={12}
      style={({ pressed }) => [
        styles.base,
        { width: dim, height: dim, borderRadius: size === 'sm' ? 12 : 14 },
        pressed && styles.pressed,
        style,
      ]}
    >
      <Ionicons name={icon} size={size === 'sm' ? 18 : 20} color={fg} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: layout.tapMin,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(46,46,46,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider.subtle,
  },
  pressed: {
    backgroundColor: 'rgba(255, 217, 61, 0.10)',
    borderColor: 'rgba(255, 217, 61, 0.22)',
    transform: [{ scale: 0.97 }],
  },
});

