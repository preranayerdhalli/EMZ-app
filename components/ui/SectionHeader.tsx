import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography, fonts } from '@/constants/theme';

export function SectionHeader({
  title,
  right,
  subtitle,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  left: { flex: 1, paddingRight: spacing.md, gap: 2 },
  right: { alignItems: 'flex-end', justifyContent: 'flex-end' },
  title: {
    fontSize: typography.sectionHeader.fontSize,
    lineHeight: typography.sectionHeader.lineHeight,
    fontFamily: fonts.display,
    color: colors.ink.primary,
  },
  subtitle: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: fonts.bodyLight,
    color: colors.ink.tertiary,
  },
});
