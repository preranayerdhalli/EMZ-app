import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { colors, typography, fonts, palette } from '@/constants/theme';
import type { DayLoad, DayLoadDots, CalendarItem, SyncedEvent, TaskBlock } from '@/constants/calendarTypes';
import { CALENDAR_EVENT_COLOR } from '@/constants/calendarTypes';
import { hourLabel } from '@/utils/time';

const DEFAULT_START = 7;
const DEFAULT_END = 21;
const HOUR_HEIGHT = 56;
const TIME_COL_W = 44;
const DAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const TASK_COLORS: Record<string, { bg: string; border: string }> = {
  deep:     { bg: 'rgba(255,138,61,0.18)',  border: '#FF8A3D' },
  creative: { bg: 'rgba(47,93,140,0.16)', border: '#2F5D8C' },
  admin:    { bg: 'rgba(184,176,166,0.20)', border: '#B8B0A6' },
  chore:    { bg: 'rgba(111,166,106,0.18)',  border: '#6FA66A' },
  recovery: { bg: 'rgba(255,215,0,0.16)',  border: 'palette.accentYellow' },
  learning: { bg: 'rgba(212,138,106,0.16)', border: '#D48A6A' },
  social:   { bg: 'rgba(255,179,107,0.16)',  border: '#FFB36B' },
};

export type WeekDay = {
  date: string;
  dayName: string;
  dayNum: number;
  load: DayLoad;
  dots: DayLoadDots;
};

type Props = {
  weekStart: Date;
  selectedDate: string | null;
  onSelectDay: (date: string) => void;
  onItemPress?: (item: CalendarItem) => void;
  getDayLoad: (date: string) => DayLoad;
  getDayDots: (date: string) => DayLoadDots;
  getItemsForDate: (date: string) => CalendarItem[];
  hasAnyItems?: boolean;
};

function getWeekDates(weekStart: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

function getEndMinutes(item: CalendarItem): number {
  return item.type === 'event'
    ? (item.data as SyncedEvent).endMinutes
    : (item.data as TaskBlock).endMinutes;
}

function getBlockColor(item: CalendarItem): { bg: string; border: string } {
  if (item.type === 'event') return { bg: CALENDAR_EVENT_COLOR.bg, border: CALENDAR_EVENT_COLOR.border };
  return TASK_COLORS[(item.data as TaskBlock).workType] ?? TASK_COLORS.admin;
}

export function WeekView({
  weekStart,
  selectedDate,
  onSelectDay,
  onItemPress,
  getItemsForDate,
  hasAnyItems = false,
}: Props) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const dates = getWeekDates(weekStart);
  const todayCol = dates.indexOf(todayStr);

  const allItems = useMemo(() => {
    const combined: CalendarItem[] = [];
    for (const d of dates) {
      combined.push(...getItemsForDate(d));
    }
    return combined;
  }, [dates, getItemsForDate]);

  const { startHour, endHour } = useMemo(() => {
    if (allItems.length === 0) return { startHour: DEFAULT_START, endHour: DEFAULT_END };
    let earliest = Infinity;
    let latest = -Infinity;
    for (const item of allItems) {
      earliest = Math.min(earliest, item.data.startMinutes);
      latest = Math.max(latest, getEndMinutes(item));
    }
    const s = Math.max(0, Math.floor((earliest - 30) / 60));
    const e = Math.min(24, Math.ceil((latest + 30) / 60));
    return { startHour: Math.min(s, DEFAULT_START), endHour: Math.max(e, DEFAULT_END) };
  }, [allItems]);

  const hourCount = endHour - startHour;
  const gridHeight = hourCount * HOUR_HEIGHT;

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nowY =
    nowMinutes >= startHour * 60 && nowMinutes <= endHour * 60
      ? ((nowMinutes - startHour * 60) / 60) * HOUR_HEIGHT
      : -1;

  return (
    <View style={styles.root}>
      {/* Day header */}
      <View style={styles.header}>
        <View style={{ width: TIME_COL_W }} />
        {dates.map((dateStr, i) => {
          const d = new Date(dateStr);
          const num = d.getDate();
          const isToday = dateStr === todayStr;
          const isSelected = !isToday && dateStr === selectedDate;
          return (
            <Pressable
              key={dateStr}
              style={styles.headerCell}
              onPress={() => onSelectDay(dateStr)}
            >
              <Text style={[styles.dayInitial, isToday && styles.dayInitialToday]}>
                {DAY_INITIALS[i]}
              </Text>
              {isToday ? (
                <View style={styles.todayBadge}>
                  <Text style={styles.todayNum}>{num}</Text>
                </View>
              ) : isSelected ? (
                <View style={styles.selectedBadge}>
                  <Text style={styles.selectedNum}>{num}</Text>
                </View>
              ) : (
                <Text style={styles.dayNum}>{num}</Text>
              )}
            </Pressable>
          );
        })}
      </View>

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
                <Text style={styles.timeLabel}>{hourLabel(startHour + i)}</Text>
              </View>
            ))}
          </View>

          {/* Day columns */}
          {dates.map((dateStr) => {
            const isToday = dateStr === todayStr;
            const items = getItemsForDate(dateStr);
            return (
              <View
                key={dateStr}
                style={[styles.dayCol, isToday && styles.dayColToday]}
              >
                {Array.from({ length: hourCount }, (_, i) => (
                  <View key={i} style={[styles.hourLine, { top: i * HOUR_HEIGHT }]} />
                ))}

                {items.map((item) => {
                  const start = item.data.startMinutes;
                  const end = getEndMinutes(item);
                  if (start < startHour * 60 || start >= endHour * 60) return null;
                  const top = ((start - startHour * 60) / 60) * HOUR_HEIGHT + 1;
                  const height = Math.max(((end - start) / 60) * HOUR_HEIGHT - 2, 20);
                  const isEvent = item.type === 'event';
                  const { bg, border } = getBlockColor(item);
                  const textLines = Math.max(1, Math.floor((height - 6) / 11));

                  return (
                    <Pressable
                      key={item.data.id}
                      style={[
                        styles.block,
                        { top, height, backgroundColor: bg, borderLeftColor: border },
                      ]}
                      onPress={() => (onItemPress ? onItemPress(item) : onSelectDay(dateStr))}
                    >
                      <Text
                        style={[styles.blockText, isEvent && styles.blockTextEvent]}
                        numberOfLines={textLines}
                      >
                        {item.data.title}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            );
          })}

          {/* Current-time indicator */}
          {todayCol >= 0 && nowY >= 0 && (
            <View
              style={[styles.nowLine, { top: nowY }]}
              pointerEvents="none"
            >
              <View style={{ width: TIME_COL_W }} />
              {Array.from({ length: 7 }, (_, i) => (
                <View
                  key={i}
                  style={[
                    styles.nowSegment,
                    i === todayCol && styles.nowSegmentActive,
                  ]}
                />
              ))}
            </View>
          )}
        </View>

        {!hasAnyItems && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Add your first task to get started</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  /* Header */
  header: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(31,26,20,0.10)',
  },
  headerCell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  dayInitial: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontWeight: typography.caption.fontWeight,
    color: colors.ink.tertiary,
  },
  dayInitialToday: {
    color: colors.brandGold,
    fontWeight: '650',
  },
  dayNum: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: fonts.bodyRegular,
    color: colors.ink.secondary,
    lineHeight: 22,
  },
  todayBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.brandGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayNum: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontWeight: '750',
    color: colors.ink.primary,
  },
  selectedBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,215,0,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedNum: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: fonts.bodyMedium,
    color: colors.brandGold,
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
    paddingRight: 6,
    alignItems: 'flex-end',
  },
  timeLabel: {
    fontSize: 10,
    fontFamily: fonts.bodyRegular,
    color: colors.ink.tertiary,
    marginTop: -5,
  },
  dayCol: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: 'rgba(31,26,20,0.06)',
  },
  dayColToday: {
    backgroundColor: 'rgba(255,204,3,0.03)',
  },
  hourLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(31,26,20,0.08)',
  },

  /* Event block */
  block: {
    position: 'absolute',
    left: 1,
    right: 1,
    borderRadius: 3,
    borderLeftWidth: 3,
    paddingHorizontal: 3,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  blockText: {
    fontSize: 9,
    fontFamily: fonts.bodyMedium,
    color: colors.bodyText,
    lineHeight: 11,
  },
  blockTextEvent: {
    color: 'palette.background',
  },

  /* Current time */
  nowLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 20,
  },
  nowSegment: {
    flex: 1,
    height: 1,
    backgroundColor: 'transparent',
  },
  nowSegmentActive: {
    height: 2,
    backgroundColor: colors.coral,
  },

  /* Empty */
  emptyState: {
    paddingTop: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: colors.textTertiary,
  },
});
