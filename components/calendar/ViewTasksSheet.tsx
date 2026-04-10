import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, fonts, palette } from '@/constants/theme';
import type { CalendarItem, TaskBlock } from '@/constants/calendarTypes';
import { WORK_TYPE_LABEL } from '@/constants/calendarTypes';
import { EventDetailSheet } from './EventDetailSheet';
import { fmtTime } from '@/utils/time';

type Props = {
  visible: boolean;
  onClose: () => void;
  tasks: CalendarItem[];
  onItemPress: (item: CalendarItem) => void;
  onAddTask: () => void;
  onEditTask: (item: CalendarItem) => void;
};

export function ViewTasksSheet({
  visible,
  onClose,
  tasks,
  onItemPress,
  onAddTask,
  onEditTask,
}: Props) {
  const [detailItem, setDetailItem] = useState<CalendarItem | null>(null);

  const taskItems = tasks.filter((i): i is CalendarItem & { type: 'task' } => i.type === 'task');

  const handleCloseDetail = () => setDetailItem(null);
  const handleEdit = (item: CalendarItem) => {
    setDetailItem(null);
    onEditTask(item);
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <Pressable style={styles.overlay} onPress={onClose}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <Text style={styles.title}>View & edit tasks</Text>
              <Pressable onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={colors.onDarkTertiary} />
              </Pressable>
            </View>
            <Text style={styles.subtitle}>
              Tap a task to view it, then tap “Edit task” to change it. Tasks you schedule in the app appear here.
            </Text>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {taskItems.length === 0 ? (
                <View style={styles.empty}>
                  <Ionicons name="checkbox-outline" size={48} color={colors.onDarkTertiary} />
                  <Text style={styles.emptyTitle}>No tasks yet</Text>
                  <Text style={styles.emptySub}>Schedule a task from the calendar to see it here.</Text>
                </View>
              ) : (
                taskItems.map((item) => {
                  const t = item.data as TaskBlock;
                  return (
                    <Pressable
                      key={item.data.id}
                      style={styles.taskRow}
                      onPress={() => setDetailItem(item)}
                    >
                      <View style={styles.taskLeft}>
                        <Text style={styles.taskTitle} numberOfLines={2}>{t.title}</Text>
                        <Text style={styles.taskMeta}>
                          {item.data.date} · {fmtTime(t.startMinutes)} – {fmtTime(t.endMinutes)} · {WORK_TYPE_LABEL[t.workType] ?? t.workType}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.onDarkTertiary} />
                    </Pressable>
                  );
                })
              )}
            </ScrollView>

            <Pressable style={styles.addBtn} onPress={onAddTask}>
              <Text style={styles.addBtnText}>Add task</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <EventDetailSheet
        visible={detailItem !== null}
        item={detailItem}
        onClose={handleCloseDetail}
        onEdit={detailItem?.type === 'task' ? () => detailItem && handleEdit(detailItem) : undefined}
      />
    </>
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
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['3xl'],
    maxHeight: '88%',
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
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.onDarkText,
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
  subtitle: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    color: colors.onDarkSecondary,
    marginBottom: spacing.lg,
    lineHeight: 19,
  },
  scroll: { flex: 1, maxHeight: 400 },
  scrollContent: { paddingBottom: spacing.lg },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: fonts.bodyMedium,
    color: colors.onDarkSecondary,
  },
  emptySub: {
    fontSize: 13,
    color: colors.onDarkTertiary,
    textAlign: 'center',
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: borderRadius.cardSm,
    padding: 14,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  taskLeft: { flex: 1, gap: 4 },
  taskTitle: {
    fontSize: 15,
    fontWeight: '650',
    color: colors.onDarkText,
    lineHeight: 20,
  },
  taskMeta: {
    fontSize: 12,
    color: colors.onDarkTertiary,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primaryYellow,
    borderRadius: borderRadius.button,
    paddingVertical: 14,
    marginTop: spacing.md,
  },
  addBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.bodyText,
  },
});
