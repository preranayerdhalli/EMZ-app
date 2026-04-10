import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { colors, typography, fonts, palette } from '@/constants/theme';
import type { CalendarItem, SyncedEvent, TaskBlock } from '@/constants/calendarTypes';
import { SOURCE_NAME, CALENDAR_EVENT_COLOR } from '@/constants/calendarTypes';
import { fmtTime } from '@/utils/time';

const DEFAULT_START_MINUTES = 8 * 60 + 30; // 8:30 AM
const DEFAULT_END = 21;
const HOUR_HEIGHT = 60;
const TIME_COL_W = 44;

const TASK_COLORS: Record<string, { bg: string; border: string }> = {
  deep:     { bg: 'rgba(255,138,61,0.18)',  border: '#FF8A3D' },
  creative: { bg: 'rgba(47,93,140,0.16)', border: '#2F5D8C' },
  admin:    { bg: 'rgba(184,176,166,0.20)', border: '#B8B0A6' },
  chore:    { bg: 'rgba(111,166,106,0.18)',  border: '#6FA66A' },
  recovery: { bg: 'rgba(255,215,0,0.16)',  border: 'palette.accentYellow' },
  learning: { bg: 'rgba(212,138,106,0.16)', border: '#D48A6A' },
  social:   { bg: 'rgba(255,179,107,0.16)',  border: '#FFB36B' },
};

type Props = {
  date: string;
  items: CalendarItem[];
  suggestedItems?: CalendarItem[];
  suggestedContext?: string;
  onItemPress?: (item: CalendarItem) => void;
};

function getEndMinutes(item: CalendarItem): number {
  return item.type === 'event'
    ? (item.data as SyncedEvent).endMinutes
    : (item.data as TaskBlock).endMinutes;
}

function computeRange(allItems: CalendarItem[]): { startMinutes: number; endHour: number } {
  if (allItems.length === 0) return { startMinutes: DEFAULT_START_MINUTES, endHour: DEFAULT_END };

  let earliest = Infinity;
  let latest = -Infinity;
  for (const item of allItems) {
    earliest = Math.min(earliest, item.data.startMinutes);
    latest = Math.max(latest, getEndMinutes(item));
  }

  // Start 30 minutes before first event, rounded down to 30-min, but no earlier than 8:30 AM
  const beforeFirst = Math.floor((earliest - 30) / 30) * 30;
  const startMinutes = Math.max(DEFAULT_START_MINUTES, beforeFirst);
  const endHour = Math.min(24, Math.ceil((latest + 30) / 60));
  return { startMinutes, endHour: Math.max(endHour, DEFAULT_END) };
}

function Block({
  item,
  onPress,
  startMinutes,
}: {
  item: CalendarItem;
  onPress?: () => void;
  startMinutes: number;
}) {
  const start = item.data.startMinutes;
  const end = getEndMinutes(item);
  if (start < startMinutes) return null;
  const top = ((start - startMinutes) / 60) * HOUR_HEIGHT + 1;
  const height = Math.max(((end - start) / 60) * HOUR_HEIGHT - 2, 28);
  const isEvent = item.type === 'event';
  const tc = !isEvent ? (TASK_COLORS[(item.data as TaskBlock).workType] ?? TASK_COLORS.admin) : null;
  const bg = isEvent ? CALENDAR_EVENT_COLOR.bg : tc!.bg;
  const borderColor = isEvent ? CALENDAR_EVENT_COLOR.border : tc!.border;
  const textLines = Math.max(1, Math.floor((height - 8) / 15));

  return (
    <Pressable
      style={[styles.block, { top, height, backgroundColor: bg, borderLeftColor: borderColor }]}
      onPress={onPress}
    >
      {isEvent ? (
        <View style={styles.blockInner}>
          <Text style={[styles.blockTitle, styles.blockTitleEvent]} numberOfLines={textLines}>
            {(item.data as SyncedEvent).title}
          </Text>
          <View style={styles.srcBadge}>
            <Text style={styles.srcText}>{SOURCE_NAME[(item.data as SyncedEvent).source]}</Text>
          </View>
        </View>
      ) : (
        <Text style={styles.blockTitle} numberOfLines={textLines}>
          {(item.data as TaskBlock).title}
        </Text>
      )}
    </Pressable>
  );
}

export function DayView({ date, items, suggestedItems = [], suggestedContext, onItemPress }: Props) {
  const now = new Date();
  const isToday = date === now.toISOString().slice(0, 10);
  const nowMins = now.getHours() * 60 + now.getMinutes();

  const allItems = useMemo(() => [...items, ...suggestedItems], [items, suggestedItems]);
  const { startMinutes, endHour } = useMemo(() => computeRange(allItems), [allItems]);

  const endMinutes = endHour * 60;
  const hourCount = Math.ceil((endMinutes - startMinutes) / 60);
  const gridHeight = hourCount * HOUR_HEIGHT;

  const nowY =
    isToday && nowMins >= startMinutes && nowMins <= endMinutes
      ? ((nowMins - startMinutes) / 60) * HOUR_HEIGHT
      : -1;

  const sortedYour = [...items].sort((a, b) => a.data.startMinutes - b.data.startMinutes);
  const eventsFromYourDay = items.filter((i) => i.type === 'event');
  const tasksFromSuggested = suggestedItems.filter((i) => i.type === 'task');
  const sortedSuggested = [...eventsFromYourDay, ...tasksFromSuggested].sort(
    (a, b) => a.data.startMinutes - b.data.startMinutes,
  );

  return (
    <View style={styles.root}>
      {/* Column headers */}
      <View style={styles.colHeaders}>
        <View style={{ width: TIME_COL_W }} />
        <View style={styles.colHeader}>
          <Text style={styles.colHeaderText}>Your day</Text>
        </View>
        <View style={styles.colDivider} />
        <View style={styles.colHeader}>
          <Text style={[styles.colHeaderText, styles.colHeaderTextSuggested]}>Suggested</Text>
        </View>
      </View>

      {/* Suggested context hint — centered across full width */}
      {suggestedContext ? (
        <View style={styles.contextRow}>
          <Text style={styles.contextText} numberOfLines={2}>{suggestedContext}</Text>
        </View>
      ) : null}

      {/* Scrollable time grid */}
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View style={[styles.grid, { height: gridHeight }]}>
          {/* Time labels */}
          <View style={[styles.timeCol, { width: TIME_COL_W }]}>
            {Array.from({ length: hourCount }, (_, i) => (
              <View key={i} style={[styles.timeLabelSlot, { height: HOUR_HEIGHT }]}>
                <Text style={styles.timeLabel}>{fmtTime(startMinutes + i * 60)}</Text>
              </View>
            ))}
          </View>

          {/* Your Day column */}
          <View style={styles.eventsCol}>
            {Array.from({ length: hourCount }, (_, i) => (
              <View key={`yl${i}`} style={[styles.hourLine, { top: i * HOUR_HEIGHT }]} />
            ))}
            {Array.from({ length: hourCount }, (_, i) => (
              <View key={`yh${i}`} style={[styles.halfLine, { top: i * HOUR_HEIGHT + HOUR_HEIGHT / 2 }]} />
            ))}
            {nowY >= 0 && (
              <View style={[styles.nowRow, { top: nowY }]} pointerEvents="none">
                <View style={styles.nowDot} />
                <View style={styles.nowLine} />
              </View>
            )}
            {sortedYour.map((item) => (
              <Block key={item.data.id} item={item} startMinutes={startMinutes} onPress={onItemPress ? () => onItemPress(item) : undefined} />
            ))}
          </View>

          {/* Center divider */}
          <View style={styles.colDividerLine} />

          {/* Suggested column */}
          <View style={[styles.eventsCol, styles.suggestedCol]}>
            {Array.from({ length: hourCount }, (_, i) => (
              <View key={`sl${i}`} style={[styles.hourLine, { top: i * HOUR_HEIGHT }]} />
            ))}
            {Array.from({ length: hourCount }, (_, i) => (
              <View key={`sh${i}`} style={[styles.halfLine, { top: i * HOUR_HEIGHT + HOUR_HEIGHT / 2 }]} />
            ))}
            {nowY >= 0 && (
              <View style={[styles.nowRow, { top: nowY }]} pointerEvents="none">
                <View style={styles.nowLine} />
              </View>
            )}
            {sortedSuggested.map((item) => (
              <Block key={item.data.id} item={item} startMinutes={startMinutes} onPress={onItemPress ? () => onItemPress(item) : undefined} />
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  /* Column headers */
  colHeaders: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(31,26,20,0.10)',
  },
  colHeader: {
    flex: 1,
    alignItems: 'center',
  },
  colHeaderText: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: fonts.bodyMedium,
    color: colors.ink.tertiary,
  },
  colHeaderTextSuggested: {
    fontFamily: fonts.bodyMedium,
    color: colors.ink.primary,
  },
  colDivider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(31,26,20,0.12)',
  },

  /* Context hint — centered */
  contextRow: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  contextText: {
    fontSize: 10,
    color: colors.textTertiary,
    lineHeight: 14,
    fontStyle: 'italic',
    textAlign: 'center',
  },

  /* Grid */
  scroll: { flex: 1 },
  grid: {
    flexDirection: 'row',
    position: 'relative',
  },
  timeCol: { flexShrink: 0 },
  timeLabelSlot: {
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingRight: 6,
  },
  timeLabel: {
    fontSize: 10,
    fontFamily: fonts.bodyRegular,
    color: colors.textTertiary,
    marginTop: -5,
  },
  eventsCol: {
    flex: 1,
    position: 'relative',
  },
  suggestedCol: {
    backgroundColor: 'rgba(255,215,0,0.12)',
  },
  hourLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(31,26,20,0.08)',
  },
  halfLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(31,26,20,0.04)',
  },
  colDividerLine: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(31,26,20,0.12)',
  },

  /* Current time */
  nowRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  nowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.coral,
    marginLeft: -4,
    zIndex: 11,
  },
  nowLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.coral,
    opacity: 0.6,
  },

  /* Event block */
  block: {
    position: 'absolute',
    left: 2,
    right: 2,
    borderRadius: 4,
    borderLeftWidth: 3,
    paddingHorizontal: 6,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  blockInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
  },
  blockTitle: {
    flex: 1,
    fontSize: 12,
    fontFamily: fonts.bodyMedium,
    color: colors.bodyText,
    lineHeight: 15,
  },
  blockTitleEvent: {
    color: 'palette.background',
  },
  srcBadge: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
    flexShrink: 0,
  },
  srcText: {
    fontSize: 8,
    fontFamily: fonts.bodyMedium,
    color: 'rgba(255,255,255,0.80)',
    letterSpacing: 0.3,
  },
});
