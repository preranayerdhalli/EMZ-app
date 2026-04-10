import { View, Text, StyleSheet, Pressable, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, fonts } from '@/constants/theme';

export function ScreenHeaderTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.titleWrap}>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

export function HeaderIconButton({
  icon,
  onPress,
  accessibilityLabel,
  tone = 'neutral',
  style,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
  tone?: 'neutral' | 'accent';
  style?: ViewStyle;
}) {
  const fg = tone === 'accent' ? colors.brandGold : colors.textPrimary;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={10}
      style={({ pressed }) => [
        styles.iconBtn,
        style,
        pressed && styles.iconBtnPressed,
      ]}
    >
      <Ionicons name={icon} size={18} color={fg} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  titleWrap: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 2,
    paddingBottom: 2,
  },
  title: {
    fontSize: typography.cardTitle.fontSize,
    lineHeight: typography.cardTitle.lineHeight,
    fontFamily: fonts.display,
    color: colors.ink.primary,
    letterSpacing: 0,
  },
  subtitle: {
    fontSize: typography.micro.fontSize,
    lineHeight: typography.micro.lineHeight,
    fontFamily: fonts.bodyLight,
    color: colors.ink.tertiary,
    letterSpacing: typography.micro.letterSpacing,
    textTransform: typography.micro.textTransform,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(46, 46, 46, 0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider.subtle,
  },
  iconBtnPressed: {
    backgroundColor: 'rgba(255, 217, 61, 0.12)',
    borderColor: 'rgba(255, 217, 61, 0.22)',
    transform: [{ scale: 0.97 }],
  },
});
