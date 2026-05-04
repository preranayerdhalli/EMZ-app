import { useState, useCallback, useLayoutEffect, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { HeaderIconButton } from '@/components/ScreenHeader';
import { Ionicons } from '@expo/vector-icons';
import { AppBackground } from '@/components/AuthBackground';
import { ScreenHeaderTitle } from '@/components/ScreenHeader';
import {
  AddTaskSheet,
  ConnectedCalendarsSheet,
  ViewTasksSheet,
} from '@/components/calendar';
import type { TaskInput } from '@/components/calendar/AddTaskSheet';
import {
  colors,
  spacing,
  fonts,
  palette,
  borderRadius as br,
  cardShadow,
} from '@/constants/theme';
import { useCalendarItems } from '@/hooks/useCalendarItems';
import { useEnergy } from '@/hooks/useEnergy';
import type { CalendarItem, CalendarSource } from '@/constants/calendarTypes';
import {
  connectGoogleCalendar,
  connectMicrosoftCalendar,
  syncAppleCalendar,
  syncGoogleCalendar,
  syncMicrosoftCalendar,
  getConnectedCalendars,
} from '@/services/calendar';
import { usePostHog } from 'posthog-react-native';

// ─── Timeline constants ───────────────────────────────────────────────────────

const HOUR_HEIGHT = 64;
const DAY_START_HOUR = 0;
const DAY_END_HOUR = 24;
const DAY_START_MIN = DAY_START_HOUR * 60;
const HOURS = Array.from(
  { length: DAY_END_HOUR - DAY_START_HOUR },
  (_, i) => DAY_START_HOUR + i
);
const TIME_LABEL_W = 44;
const CARD_LEFT = TIME_LABEL_W + 8;
const TAB_BAR_HEIGHT = 64;
const FAB_SIZE = 52;
const ENERGY_PANEL_W = 108;

// ─── Energy levels ────────────────────────────────────────────────────────────

type EnergyLevel = 'high' | 'moderate' | 'low';
type WorkType = 'deep' | 'creative' | 'admin' | 'recovery';

// Energy data is now driven by useEnergy() hook — see EnergyRow component below

const ENERGY_COLOR: Record<EnergyLevel, string> = {
  high:     palette.accentYellow,
  moderate: palette.accentOrangeLight,
  low:      palette.accentOrange,
};



// Horizontal dot position within energy panel: right = high, left = low
const ENERGY_DOT_X: Record<EnergyLevel, number> = {
  high:     ENERGY_PANEL_W - 18,
  moderate: ENERGY_PANEL_W / 2 - 4,
  low:      10,
};

function getTaskEnergy(workType: string): EnergyLevel {
  if (workType === 'deep' || workType === 'creative' || workType === 'learning') return 'high';
  if (workType === 'admin' || workType === 'chore') return 'moderate';
  return 'low';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTodayStr() { return new Date().toISOString().slice(0, 10); }

function fmtHour(hour: number): string {
  if (hour === 12) return '12p';
  if (hour === 0) return '12a';
  return hour < 12 ? `${hour}a` : `${hour - 12}p`;
}

function fmtDuration(startMinutes: number, endMinutes: number): string {
  const dur = endMinutes - startMinutes;
  if (dur <= 0) return '';
  if (dur < 60) return `${dur}m`;
  const h = Math.floor(dur / 60);
  const m = dur % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function minToTop(minutes: number): number {
  return ((minutes - DAY_START_MIN) / 60) * HOUR_HEIGHT;
}

function getCurrentTimeTop(): number {
  const now = new Date();
  return minToTop(now.getHours() * 60 + now.getMinutes());
}

const DEFAULT_CONNECTIONS = [
  { source: 'google' as CalendarSource, connected: false, visible: true },
  { source: 'microsoft' as CalendarSource, connected: false, visible: true },
  { source: 'apple' as CalendarSource, connected: false, visible: true },
];

// ─── Timeline card ────────────────────────────────────────────────────────────

function TimelineCard({
  item,
  cardWidth,
}: {
  item: CalendarItem;
  cardWidth: number;
}) {
  const isEvent = item.type === 'event';
  const { startMinutes, endMinutes, title } = item.data;

  const top = minToTop(startMinutes);
  const rawHeight = ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT;
  const height = Math.max(rawHeight, 30);

  const energy: EnergyLevel = isEvent
    ? 'moderate'
    : getTaskEnergy((item.data as any).workType ?? '');
  const accentColor = ENERGY_COLOR[energy];
  const duration = fmtDuration(startMinutes, endMinutes);
  const compact = rawHeight < 38;

  return (
    <View
      style={[
        styles.card,
        isEvent && styles.cardEvent,
        { top, height, left: CARD_LEFT, width: cardWidth },
      ]}
    >
      <View style={[styles.cardAccent, { backgroundColor: accentColor }]} />
      <View style={styles.cardBody}>
        {compact ? (
          <Text style={styles.cardTitle} numberOfLines={1}>{title}</Text>
        ) : (
          <>
            <Text style={styles.cardTitle} numberOfLines={1}>{title}</Text>
            <Text style={styles.cardDuration}>{duration}</Text>
          </>
        )}
      </View>
    </View>
  );
}

// ─── Energy panel row ─────────────────────────────────────────────────────────

const WORK_TYPE_LABELS: Record<string, string> = {
  deep: 'Deep Work', creative: 'Creative', admin: 'Admin',
  chore: 'Chore', recovery: 'Recovery', learning: 'Learning', social: 'Social',
};

function EnergyRow({
  hour,
  energy,
  suggestedWorkType,
  prevSuggestedWorkType,
  isMicroBreak,
  hasData,
}: {
  hour: number;
  energy: EnergyLevel;
  suggestedWorkType: string;
  prevSuggestedWorkType: string | null;
  isMicroBreak: boolean;
  hasData: boolean;
}) {
  const label = isMicroBreak ? 'Break' : (WORK_TYPE_LABELS[suggestedWorkType] ?? suggestedWorkType);
  const prevLabel = prevSuggestedWorkType
    ? (isMicroBreak ? 'Break' : (WORK_TYPE_LABELS[prevSuggestedWorkType] ?? prevSuggestedWorkType))
    : null;
  const showLabel = hasData && (!prevLabel || prevLabel !== label);
  const dotX = ENERGY_DOT_X[energy];

  return (
    <View style={energyStyles.row}>
      {showLabel && (
        <Text style={energyStyles.workLabel} numberOfLines={1}>{label}</Text>
      )}
      {hasData && <View style={[energyStyles.dot, { left: dotX }]} />}
    </View>
  );
}

// ─── Timeline (side-by-side) ──────────────────────────────────────────────────

function Timeline({
  items,
  scrollRef,
  energyByHour,
  hasData,
}: {
  items: CalendarItem[];
  scrollRef: React.RefObject<ScrollView | null>;
  energyByHour: Record<number, { energyLevel: EnergyLevel; suggestedWorkType: string; isMicroBreak: boolean }>;
  hasData: boolean;
}) {
  const { width } = useWindowDimensions();
  // Left panel width = total - divider - energy panel
  const leftPanelW = width - 1 - ENERGY_PANEL_W;
  const cardWidth = leftPanelW - CARD_LEFT - 8;
  const totalHeight = HOURS.length * HOUR_HEIGHT;
  const [nowTop, setNowTop] = useState(getCurrentTimeTop);

  useEffect(() => {
    const id = setInterval(() => setNowTop(getCurrentTimeTop()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const target = Math.max(0, nowTop - HOUR_HEIGHT);
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: target, animated: false });
    }, 100);
    return () => clearTimeout(t);
  }, []);

  const visibleItems = items;

  const showNow = nowTop >= 0 && nowTop <= totalHeight;

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.timelineScroll}
      contentContainerStyle={{ height: totalHeight + 32 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ flexDirection: 'row', height: totalHeight }}>

        {/* ── Left: Calendar column ── */}
        <View style={[styles.calendarCol, { width: leftPanelW }]}>

          {/* Hour rows */}
          {HOURS.map((hour) => (
            <View
              key={hour}
              style={[
                styles.hourRow,
                { top: (hour - DAY_START_HOUR) * HOUR_HEIGHT },
              ]}
            >
              <Text style={styles.hourLabel}>{fmtHour(hour)}</Text>
              <View style={styles.hourLine} />
            </View>
          ))}

          {/* Cards */}
          {visibleItems.map((item) => (
            <TimelineCard key={item.data.id} item={item} cardWidth={cardWidth} />
          ))}

          {/* Current time indicator */}
          {showNow && (
            <View style={[styles.nowLine, { top: nowTop }]}>
              <View style={styles.nowDot} />
              <View style={styles.nowBar} />
            </View>
          )}
        </View>

        {/* ── Divider ── */}
        <View style={styles.panelDivider} />

        {/* ── Right: Energy panel ── */}
        <View style={{ width: ENERGY_PANEL_W }}>
          {HOURS.map((hour) => {
            const data = energyByHour[hour] ?? { energyLevel: 'moderate', suggestedWorkType: 'admin', isMicroBreak: false };
            const prevData = energyByHour[hour - 1];
            return (
              <EnergyRow
                key={hour}
                hour={hour}
                energy={data.energyLevel}
                suggestedWorkType={data.suggestedWorkType}
                prevSuggestedWorkType={prevData?.suggestedWorkType ?? null}
                isMicroBreak={data.isMicroBreak}
                hasData={hasData}
              />
            );
          })}
        </View>

      </View>
    </ScrollView>
  );
}

// ─── Column headers ───────────────────────────────────────────────────────────

function ColumnHeaders() {
  return (
    <View style={styles.columnHeaders}>
      <View style={styles.columnHeaderLeft}>
        <Text style={styles.columnHeaderText}>Schedule</Text>
      </View>
      <View style={styles.columnHeaderDivider} />
      <View style={styles.columnHeaderRight}>
        <Text style={styles.columnHeaderText}>Energy</Text>
      </View>
    </View>
  );
}

// ─── Calendar menu ────────────────────────────────────────────────────────────

function CalendarMenuModal({
  visible,
  onClose,
  onSyncCalendars,
  onViewTasks,
}: {
  visible: boolean;
  onClose: () => void;
  onSyncCalendars: () => void;
  onViewTasks: () => void;
}) {
  const options = [
    {
      id: 'tasks',
      label: 'View & edit tasks',
      icon: 'list-outline' as const,
      onPress: onViewTasks,
    },
    {
      id: 'sync',
      label: 'Sync calendars',
      icon: 'sync-outline' as const,
      onPress: onSyncCalendars,
    },
  ];
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={menuStyles.overlay} onPress={onClose}>
        <Pressable style={menuStyles.card} onPress={(e) => e.stopPropagation()}>
          {options.map((opt, idx) => (
            <Pressable
              key={opt.id}
              style={[
                menuStyles.option,
                idx === options.length - 1 && menuStyles.optionLast,
              ]}
              onPress={() => {
                opt.onPress();
                onClose();
              }}
            >
              <Ionicons name={opt.icon} size={20} color={colors.ink.secondary} />
              <Text style={menuStyles.optionLabel}>{opt.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.ink.tertiary} />
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const router = useRouter();
  const posthog = usePostHog();
  const scrollRef = useRef<ScrollView>(null);

  const [viewingDate, setViewingDate] = useState(() => getTodayStr());
  const { items, addTask, updateTask, deleteTask, markCompleted, refresh } = useCalendarItems(viewingDate);
  const { energyByHour, hasData: energyHasData } = useEnergy(viewingDate);
  const [addTaskVisible, setAddTaskVisible] = useState(false);
  const [connectedVisible, setConnectedVisible] = useState(false);
  const [viewTasksVisible, setViewTasksVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [editTask, setEditTask] = useState<CalendarItem | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [connections, setConnections] = useState(DEFAULT_CONNECTIONS);

  // Load connection state on mount, then background-sync any connected calendars
  useEffect(() => {
    getConnectedCalendars().then(async (connected) => {
      setConnections((prev) =>
        prev.map((c) => ({ ...c, connected: connected.has(c.source) }))
      );
      const syncs: Promise<void>[] = [];
      if (connected.has('google'))    syncs.push(syncGoogleCalendar().catch(() => {}));
      if (connected.has('microsoft')) syncs.push(syncMicrosoftCalendar().catch(() => {}));
      if (connected.has('apple'))     syncs.push(syncAppleCalendar().catch(() => {}));
      if (syncs.length > 0) {
        await Promise.all(syncs);
        refresh();
      }
    });
  }, []);

  const goPrev = () => {
    const d = new Date(viewingDate);
    d.setDate(d.getDate() - 1);
    setViewingDate(d.toISOString().slice(0, 10));
  };
  const goNext = () => {
    const d = new Date(viewingDate);
    d.setDate(d.getDate() + 1);
    setViewingDate(d.toISOString().slice(0, 10));
  };

  const periodLabel =
    viewingDate === getTodayStr()
      ? 'Today'
      : new Date(viewingDate).toLocaleDateString('default', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        });

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => null,
      headerTitle: () => <ScreenHeaderTitle title="Calendar" />,
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <HeaderIconButton
            icon="ellipsis-horizontal"
            accessibilityLabel="Calendar menu"
            onPress={() => setMenuVisible(true)}
          />
          <HeaderIconButton
            icon="settings-outline"
            accessibilityLabel="Settings"
            onPress={() => router.push('/settings')}
            style={{ marginRight: 8 }}
          />
        </View>
      ),
    });
  }, [navigation]);

  const handleSchedule = useCallback(
    async (task: TaskInput) => {
      const dateStr = task.dueDate.toISOString().slice(0, 10);
      const startMins = task.dueDate.getHours() * 60 + task.dueDate.getMinutes();
      const endMins = startMins + (task.durationMinutes ?? 60);
      const day = task.dueDate.toLocaleDateString(undefined, { weekday: 'long' });
      const time = task.dueDate.toLocaleTimeString(undefined, {
        hour: 'numeric', minute: '2-digit',
      });
      const dur = task.durationMinutes ? ` (${task.durationMinutes} min)` : '';

      if (task.id) {
        await updateTask(task.id, {
          title: task.title,
          workType: task.workType,
          priority: task.priority,
          date: dateStr,
          startMinutes: startMins,
          endMinutes: endMins,
        } as any);
        setToast('Task updated');
      } else {
        await addTask({
          title: task.title,
          workType: task.workType,
          priority: task.priority,
          date: dateStr,
          startMinutes: startMins,
          endMinutes: endMins,
          isRecovery: false,
          completed: false,
        } as any);
        posthog?.capture('task_created', {
          work_type: task.workType,
          priority: task.priority,
          is_procrastinated: task.isProcrastinated ?? false,
          duration_minutes: task.durationMinutes ?? 60,
        });
        const msg = task.isProcrastinated
          ? `Locked in ${day} ${time}${dur}`
          : `Scheduled ${day} ${time}${dur}`;
        setToast(msg);
      }
      setEditTask(null);
      setTimeout(() => setToast(null), 3500);
    },
    [addTask, updateTask]
  );

  const fabBottom = insets.bottom + TAB_BAR_HEIGHT + spacing.md;

  return (
    <AppBackground>
      <View style={styles.root}>

        {/* ── Date navigation ── */}
        <View style={styles.periodRow}>
          <Pressable onPress={goPrev} style={styles.chevron} accessibilityLabel="Previous day">
            <Ionicons name="chevron-back" size={18} color={colors.ink.secondary} />
          </Pressable>
          <Text style={styles.periodLabel}>{periodLabel}</Text>
          <Pressable onPress={goNext} style={styles.chevron} accessibilityLabel="Next day">
            <Ionicons name="chevron-forward" size={18} color={colors.ink.secondary} />
          </Pressable>
        </View>

        {/* ── Column headers ── */}
        <ColumnHeaders />

        {/* ── Timeline ── */}
        <Timeline
          items={items}
          scrollRef={scrollRef}
          energyByHour={energyByHour}
          hasData={energyHasData}
        />
      </View>

      {/* ── FAB ── */}
      <Pressable
        style={[styles.fab, { right: spacing.lg, bottom: fabBottom }]}
        onPress={() => {
          setEditTask(null);
          setAddTaskVisible(true);
        }}
        accessibilityLabel="Add task"
        accessibilityRole="button"
      >
        <Ionicons name="add" size={28} color={colors.bodyText} />
      </Pressable>

      {/* ── Toast ── */}
      {toast ? (
        <View style={[styles.toast, { bottom: fabBottom + FAB_SIZE + spacing.sm }]}>
          <Text style={styles.toastText} numberOfLines={2}>{toast}</Text>
        </View>
      ) : null}

      <AddTaskSheet
        visible={addTaskVisible}
        onClose={() => {
          setAddTaskVisible(false);
          setEditTask(null);
        }}
        onSchedule={handleSchedule}
        initialTask={editTask?.type === 'task' ? editTask.data : null}
      />
      <ViewTasksSheet
        visible={viewTasksVisible}
        onClose={() => setViewTasksVisible(false)}
        tasks={items}
        onItemPress={() => {}}
        onAddTask={() => {
          setViewTasksVisible(false);
          setEditTask(null);
          setAddTaskVisible(true);
        }}
        onEditTask={(item) => {
          setViewTasksVisible(false);
          setEditTask(item);
          setAddTaskVisible(true);
        }}
      />
      <CalendarMenuModal
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        onSyncCalendars={() => setConnectedVisible(true)}
        onViewTasks={() => setViewTasksVisible(true)}
      />
      <ConnectedCalendarsSheet
        visible={connectedVisible}
        onClose={() => setConnectedVisible(false)}
        connections={connections}
        onConnect={async (source) => {
          let ok = false;
          if (source === 'google')    ok = await connectGoogleCalendar();
          else if (source === 'microsoft') ok = await connectMicrosoftCalendar();
          else if (source === 'apple') { await syncAppleCalendar(); ok = true; }
          if (ok) {
            posthog?.capture('calendar_connected', { source });
            setConnections((prev) =>
              prev.map((c) => c.source === source ? { ...c, connected: true, visible: true } : c)
            );
            refresh();
            setToast(`${source} calendar connected`);
            setTimeout(() => setToast(null), 2500);
          }
        }}
        onToggleVisible={(source, visible) =>
          setConnections((prev) =>
            prev.map((c) => (c.source === source ? { ...c, visible } : c))
          )
        }
      />
    </AppBackground>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingBottom: TAB_BAR_HEIGHT,
  },

  /* Period nav */
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 4,
  },
  chevron: { padding: 6 },
  periodLabel: {
    minWidth: 96,
    textAlign: 'center',
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
    color: colors.ink.primary,
  },

  /* Column headers */
  columnHeaders: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider.strong,
    backgroundColor: 'rgba(255,255,255,0.40)',
    paddingVertical: 7,
  },
  columnHeaderLeft: {
    flex: 1,
    paddingLeft: TIME_LABEL_W + 8,
  },
  columnHeaderDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: colors.divider.strong,
  },
  columnHeaderRight: {
    width: ENERGY_PANEL_W,
    paddingHorizontal: 10,
    gap: 4,
  },
  columnHeaderText: {
    fontSize: 10,
    fontFamily: fonts.bodyMedium,
    color: colors.ink.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  energyLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 9,
    fontFamily: fonts.bodyLight,
    color: colors.ink.tertiary,
    marginRight: 2,
  },

  /* Timeline scroll */
  timelineScroll: { flex: 1 },

  /* Calendar column */
  calendarCol: {
    position: 'relative',
  },

  /* Panel divider */
  panelDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider.strong,
  },

  /* Hour row */
  hourRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: HOUR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 6,
  },
  hourLabel: {
    width: TIME_LABEL_W,
    textAlign: 'right',
    paddingRight: 8,
    fontSize: 11,
    fontFamily: fonts.bodyLight,
    color: colors.ink.secondary,
    lineHeight: 16,
  },
  hourLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    marginTop: 7,
    backgroundColor: colors.divider.subtle,
  },

  /* Cards */
  card: {
    position: 'absolute',
    flexDirection: 'row',
    borderRadius: br.cardSm,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface.cardBorder,
    ...cardShadow,
  },
  cardEvent: {
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  cardAccent: {
    width: 3,
    alignSelf: 'stretch',
  },
  cardBody: {
    flex: 1,
    paddingHorizontal: 7,
    paddingVertical: 5,
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 11,
    fontFamily: fonts.bodyMedium,
    color: colors.ink.primary,
    lineHeight: 15,
    flexShrink: 1,
  },
  cardDuration: {
    fontSize: 10,
    fontFamily: fonts.bodyLight,
    color: colors.ink.secondary,
    marginTop: 1,
  },

  /* Current time */
  nowLine: {
    position: 'absolute',
    left: TIME_LABEL_W - 4,
    right: 4,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  nowDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: palette.accentOrange,
  },
  nowBar: {
    flex: 1,
    height: 1.5,
    backgroundColor: palette.accentOrange,
  },

  /* FAB */
  fab: {
    position: 'absolute',
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: palette.accentYellow,
    justifyContent: 'center',
    alignItems: 'center',
    ...cardShadow,
  },

  /* Toast */
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: palette.backgroundSecondary,
    borderRadius: br.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface.sheetBorder,
    ...cardShadow,
  },
  toastText: {
    fontSize: 12,
    fontFamily: fonts.bodyRegular,
    color: colors.ink.primary,
    textAlign: 'center',
  },
});

const energyStyles = StyleSheet.create({
  row: {
    height: HOUR_HEIGHT,
    position: 'relative',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider.subtle,
  },
  workLabel: {
    position: 'absolute',
    top: 7,
    left: 8,
    right: 8,
    fontSize: 10,
    fontFamily: fonts.bodyMedium,
    color: colors.ink.secondary,
    lineHeight: 14,
  },
  dot: {
    position: 'absolute',
    bottom: 14,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.ink.secondary,
  },
});

const menuStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    paddingTop: 56,
    paddingLeft: spacing.sm,
    alignItems: 'flex-start',
  },
  card: {
    backgroundColor: palette.backgroundSecondary,
    borderRadius: br.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface.sheetBorder,
    minWidth: 220,
    overflow: 'hidden',
    ...cardShadow,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider.subtle,
  },
  optionLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: fonts.bodyRegular,
    color: colors.ink.primary,
  },
  optionLast: { borderBottomWidth: 0 },
});
