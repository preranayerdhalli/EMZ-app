import { Pressable, View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, fonts } from '@/constants/theme';

type Props = {
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  iconBg?: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  showDivider?: boolean;
  style?: ViewStyle;
};

export function ListRow({
  icon,
  iconColor = colors.ink.secondary,
  iconBg = 'rgba(46,46,46,0.06)',
  title,
  subtitle,
  right,
  onPress,
  destructive,
  showDivider = true,
  style,
}: Props) {
  return (
    <View style={[styles.wrap, style]}>
      <Pressable
        onPress={onPress}
        disabled={!onPress && !right}
        style={({ pressed }) => [
          styles.row,
          pressed && (onPress || right) && styles.pressed,
        ]}
      >
        {icon ? (
          <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
            <Ionicons name={icon} size={18} color={iconColor} />
          </View>
        ) : null}

        <View style={styles.body}>
          <Text style={[styles.title, destructive && { color: colors.danger }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        <View style={styles.right}>
          {right ?? (onPress ? <Ionicons name="chevron-forward" size={16} color="rgba(46,46,46,0.22)" /> : null)}
        </View>
      </Pressable>

      {showDivider ? <View style={styles.divider} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  pressed: {
    backgroundColor: 'rgba(255, 217, 61, 0.06)',
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 3 },
  title: {
    fontSize: 15,
    fontFamily: fonts.bodyMedium,
    color: colors.ink.primary,
  },
  subtitle: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: fonts.bodyLight,
    color: colors.ink.tertiary,
  },
  right: { alignItems: 'flex-end', justifyContent: 'center' },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider.subtle,
    marginLeft: 16 + 34 + 12,
  },
});
