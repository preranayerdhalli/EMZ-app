import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, typography, fonts, palette } from '@/constants/theme';
import type { CalendarItem, TaskBlock } from '@/constants/calendarTypes';
import { CALENDAR_EVENT_COLOR, WORK_TYPE_BORDER } from '@/constants/calendarTypes';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MAX_VISIBLE = 3;

type Props = {
  year: number;
  month: number;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  onItemPress?: (item: CalendarItem) => void;
  getItemsForDate: (date: string) => CalendarItem[];
};

function buildGrid(year: number, month: number): string[][] {
  const pad = (y: number, m: number, d: number) =>
    `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevY = month === 0 ? year - 1 : year;
  const prevM = month === 0 ? 12 : month;
  const prevDays = new Date(prevY, prevM, 0).getDate();

  const nextY = month === 11 ? year + 1 : year;
  const nextM = month === 11 ? 1 : month + 2;

  const cells: string[] = [];
  for (let i = startOffset - 1; i >= 0; i--)
    cells.push(pad(prevY, prevM, prevDays - i));
  for (let d = 1; d <= daysInMonth; d++)
    cells.push(pad(year, month + 1, d));
  while (cells.length < 42)
    cells.push(pad(nextY, nextM, cells.length - startOffset - daysInMonth + 1));

  const rows: string[][] = [];
  for (let r = 0; r < 6; r++) rows.push(cells.slice(r * 7, r * 7 + 7));
  return rows;
}

function getEventColor(item: CalendarItem): string {
  if (item.type === 'event') return CALENDAR_EVENT_COLOR.border;
  return WORK_TYPE_BORDER[(item.data as TaskBlock).workType] ?? colors.orange;
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return `rgba(31, 26, 20, ${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function MonthView({ year, month, selectedDate, onSelectDate, onItemPress, getItemsForDate }: Props) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const grid = buildGrid(year, month);

  return (
    <View style={styles.root}>
      {/* Day-name header */}
      <View style={styles.headerRow}>
        {DAY_LABELS.map((label, i) => (
          <View key={i} style={styles.headerCell}>
            <Text style={styles.headerLabel}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Week rows */}
      <View style={styles.grid}>
        {grid.map((week, wi) => (
          <View key={wi} style={styles.weekRow}>
            {week.map((dateStr) => {
              const [y, m] = dateStr.split('-').map(Number);
              const isCurrentMonth = y === year && m === month + 1;
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedDate && !isToday;
              const dayNum = parseInt(dateStr.split('-')[2], 10);
              const items = isCurrentMonth ? getItemsForDate(dateStr) : [];
              const overflow = items.length - MAX_VISIBLE;

              return (
                <Pressable
                  key={dateStr}
                  style={[styles.cell, isSelected && styles.cellSelected]}
                  onPress={() => onSelectDate(dateStr)}
                >
                  {/* Date number */}
                  {isToday ? (
                    <View style={styles.todayBadge}>
                      <Text style={styles.todayNum}>{dayNum}</Text>
                    </View>
                  ) : (
                    <Text style={[styles.dayNum, !isCurrentMonth && styles.dayNumFaded]}>
                      {dayNum}
                    </Text>
                  )}

                  {/* Event strips */}
                  {items.slice(0, MAX_VISIBLE).map((item) => (
                    (() => {
                      const c = getEventColor(item);
                      const bg = c.startsWith('#') ? hexToRgba(c, 0.14) : 'rgba(31,26,20,0.05)';
                      return (
                    <Pressable
                      key={item.data.id}
                      style={[styles.strip, { backgroundColor: bg, borderLeftColor: c }]}
                      onPress={() => onItemPress?.(item)}
                    >
                      <Text style={styles.stripText} numberOfLines={1} ellipsizeMode="clip">
                        {item.data.title}
                      </Text>
                    </Pressable>
                      );
                    })()
                  ))}

                  {/* Overflow indicator */}
                  {overflow > 0 && (
                    <Text style={styles.overflowText}>+{overflow} more</Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  headerRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(31,26,20,0.10)',
  },
  headerCell: {
    flex: 1,
    alignItems: 'center',
  },
  headerLabel: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontWeight: typography.caption.fontWeight,
    color: colors.ink.tertiary,
  },

  grid: { flex: 1 },
  weekRow: {
    flex: 1,
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(31,26,20,0.06)',
  },
  cell: {
    flex: 1,
    paddingTop: 4,
    paddingHorizontal: 1,
    paddingBottom: 2,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: 'rgba(31,26,20,0.06)',
    overflow: 'hidden',
  },
  cellSelected: {
    backgroundColor: 'rgba(255,204,3,0.06)',
  },

  dayNum: {
    fontSize: 11,
    fontFamily: fonts.bodyRegular,
    color: colors.ink.primary,
    textAlign: 'center',
    marginBottom: 2,
    lineHeight: 18,
  },
  dayNumFaded: {
    color: colors.ink.tertiary,
    opacity: 0.45,
  },
  todayBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.brandGold,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  todayNum: {
    fontSize: 10,
    fontFamily: fonts.bodyMedium,
    color: colors.ink.primary,
  },

  strip: {
    borderRadius: 6,
    paddingHorizontal: 3,
    paddingVertical: 1,
    marginBottom: 1,
    marginHorizontal: 1,
    borderLeftWidth: 2,
  },
  stripText: {
    fontSize: 9,
    fontFamily: fonts.bodyMedium,
    color: colors.ink.primary,
    lineHeight: 12,
  },

  overflowText: {
    fontSize: 8,
    fontFamily: fonts.bodyMedium,
    color: colors.ink.tertiary,
    textAlign: 'center',
    marginTop: 1,
    lineHeight: 10,
  },
});
