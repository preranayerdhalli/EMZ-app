import { Pressable, Text, StyleSheet, View, type ViewStyle } from 'react-native';
import { colors, borderRadius, fonts, palette } from '@/constants/theme';

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  leftDotColor?: string;
  style?: ViewStyle;
};

export function Chip({ label, selected = false, onPress, leftDotColor, style }: Props) {
  const Comp: any = onPress ? Pressable : View;
  return (
    <Comp
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }: any) => [
        styles.base,
        selected && styles.selected,
        pressed && onPress && styles.pressed,
        style,
      ]}
    >
      {leftDotColor ? <View style={[styles.dot, { backgroundColor: leftDotColor }]} /> : null}
      <Text style={[styles.text, selected && styles.textSelected]} numberOfLines={1}>
        {label}
      </Text>
    </Comp>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 34,
    borderRadius: borderRadius.pill,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.control.chipBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.control.chipBorder,
  },
  selected: {
    backgroundColor: 'rgba(255, 217, 61, 0.14)',
    borderColor: 'rgba(255, 182, 108, 0.30)',
  },
  pressed: {
    transform: [{ scale: 0.99 }],
    backgroundColor: 'rgba(255, 217, 61, 0.10)',
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: {
    fontSize: 13,
    fontFamily: fonts.bodyRegular,
    color: colors.ink.secondary,
    letterSpacing: 0.1,
  },
  textSelected: {
    color: palette.accentOrange,
    fontFamily: fonts.bodyMedium,
  },
});
