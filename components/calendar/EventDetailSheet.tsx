import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, fonts, palette } from '@/constants/theme';
import type { CalendarItem, SyncedEvent, TaskBlock } from '@/constants/calendarTypes';
import { SOURCE_NAME, WORK_TYPE_LABEL } from '@/constants/calendarTypes';
import { fmtTime } from '@/utils/time';

type Props = {
  visible: boolean;
  item: CalendarItem | null;
  onClose: () => void;
  onEdit?: () => void;
};

export function EventDetailSheet({ visible, item, onClose, onEdit }: Props) {
  if (!item) return null;

  const isEvent = item.type === 'event';
  const ev = isEvent ? (item.data as SyncedEvent) : null;
  const task = !isEvent ? (item.data as TaskBlock) : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>{item.data.title}</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.onDarkTertiary} />
            </Pressable>
          </View>

          <View style={styles.body}>
            {/* Time */}
            <View style={styles.row}>
              <Ionicons name="time-outline" size={18} color={colors.onDarkTertiary} />
              <Text style={styles.rowText}>
                {fmtTime(item.data.startMinutes)} – {fmtTime(isEvent ? ev!.endMinutes : task!.endMinutes)}
              </Text>
            </View>

            {isEvent ? (
              <>
                <View style={styles.row}>
                  <Ionicons name="calendar-outline" size={18} color={colors.onDarkTertiary} />
                  <Text style={styles.rowText}>Synced from {SOURCE_NAME[ev!.source]}</Text>
                </View>
                <View style={styles.readOnlyBadge}>
                  <Ionicons name="lock-closed" size={14} color={colors.onDarkSecondary} />
                  <Text style={styles.readOnlyText}>Read-only • Cannot be edited here</Text>
                </View>
              </>
            ) : (
              <>
                <View style={styles.row}>
                  <Ionicons name="pricetag-outline" size={18} color={colors.onDarkTertiary} />
                  <Text style={styles.rowText}>{WORK_TYPE_LABEL[task!.workType] ?? task!.workType}</Text>
                </View>
                <View style={styles.row}>
                  <Ionicons name="flag-outline" size={18} color={colors.onDarkTertiary} />
                  <Text style={styles.rowText}>Priority: {task!.priority}</Text>
                </View>
                <View style={styles.appBadge}>
                  <Text style={styles.appBadgeText}>Scheduled in app</Text>
                </View>
                {onEdit ? (
                  <Pressable style={styles.editBtn} onPress={onEdit}>
                    <Ionicons name="pencil" size={18} color={colors.bodyText} />
                    <Text style={styles.editBtnText}>Edit task</Text>
                  </Pressable>
                ) : null}
              </>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.sheetBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['3xl'],
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '750',
    color: colors.onDarkText,
    lineHeight: 24,
    letterSpacing: -0.2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowText: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    color: colors.onDarkSecondary,
  },
  readOnlyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
  },
  readOnlyText: {
    fontSize: 12,
    color: colors.onDarkSecondary,
  },
  appBadge: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,204,3,0.08)',
    borderRadius: 8,
  },
  appBadgeText: {
    fontSize: 12,
    color: colors.onDarkSecondary,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.primaryYellow,
  },
  editBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.bodyText,
  },
});
