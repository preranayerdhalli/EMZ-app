import { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AppBackground } from '@/components/AuthBackground';
import { AnimationPullUp } from '@/components/home/AnimationPullUp';
import { AnimationScreen } from '@/components/home/AnimationScreen';
import { RecoveryMomentsCard } from '@/components/home/RecoveryMomentsCard';
import { LinearGradient } from 'expo-linear-gradient';
import { useCalendarItems } from '@/hooks/useCalendarItems';
import { useEnergy } from '@/hooks/useEnergy';
import { useWeeklyStats, getWeekMonday } from '@/hooks/useWeeklyStats';
import { useDailySummary } from '@/hooks/useDailySummary';
import { useMoodCheckin } from '@/hooks/useMoodCheckin';
import { colors, spacing, borderRadius, typography, fonts, palette } from '@/constants/theme';
import { Card } from '@/components/ui';
import type { CalendarItem, TaskBlock } from '@/constants/calendarTypes';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const TAB_BAR_HEIGHT = 64;
const BEE_AREA_HEIGHT = 112;

// ─── Work type buckets ────────────────────────────────────────────────────────
// Main Focus: high-intensity, requires concentration
const MAIN_FOCUS_TYPES = new Set(['deep', 'creative', 'learning']);
// Nice to do: lighter, flexible, restorative
const NICE_TO_DO_TYPES = new Set(['recovery', 'admin', 'chore', 'social']);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getCapacity(taskCount: number, meetingMinutes: number): number {
  const meetingHours = meetingMinutes / 60;
  if (meetingHours >= 4) return Math.max(1, Math.round(taskCount * 0.3));
  if (meetingHours >= 2) return Math.max(1, Math.round(taskCount * 0.5));
  return Math.max(1, Math.round(taskCount * 0.6));
}

function getDaySummary(taskCount: number, meetingMinutes: number, capacity: number): string {
  const meetingHours = Math.round(meetingMinutes / 60);
  const meetingStr = meetingHours === 1 ? '1 hour' : `${meetingHours} hours`;
  const taskStr = taskCount === 1 ? '1 task' : `${taskCount} tasks`;
  return `You have ${taskStr} and ${meetingStr} of meetings today, based on your recovery, you can handle ${capacity} well.`;
}


function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(): string {
  return new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}


// ─── Shared color constants (needed by components defined before StyleSheet) ──
const TEXT_PRIMARY = colors.ink.primary;
const TEXT_SECONDARY = colors.ink.secondary;
const TEXT_TERTIARY = colors.ink.tertiary;

// ─── Suggested schedule (from suggested calendar, not raw Google) ───────────────

/** Build suggested task blocks for the day: same tasks, suggested times in gaps / order. */
function getSuggestedTasksForDay(dayItems: CalendarItem[]): TaskBlock[] {
  const events = dayItems
    .filter((i): i is CalendarItem & { type: 'event' } => i.type === 'event')
    .map((i) => i.data);
  const incompleteTasks = dayItems
    .filter((i): i is CalendarItem & { type: 'task' } => i.type === 'task')
    .map((i) => i.data)
    .filter((t) => !t.completed);
  if (incompleteTasks.length === 0) return [];

  const DAY_START = 7 * 60;
  const DAY_END = 21 * 60;
  const eventBlocks = [...events]
    .sort((a, b) => a.startMinutes - b.startMinutes)
    .map((e) => ({ start: e.startMinutes, end: e.endMinutes }));

  const gaps: { start: number; end: number }[] = [];
  let prevEnd = DAY_START;
  for (const b of eventBlocks) {
    if (b.start > prevEnd && b.start - prevEnd >= 15) {
      gaps.push({ start: prevEnd, end: b.start });
    }
    prevEnd = Math.max(prevEnd, b.end);
  }
  if (DAY_END > prevEnd) gaps.push({ start: prevEnd, end: DAY_END });

  const sortForSuggested = (a: TaskBlock, b: TaskBlock) => {
    if (a.priority === 'high' && b.priority !== 'high') return -1;
    if (a.priority !== 'high' && b.priority === 'high') return 1;
    const aMain = MAIN_FOCUS_TYPES.has(a.workType) ? 0 : NICE_TO_DO_TYPES.has(a.workType) ? 1 : 0;
    const bMain = MAIN_FOCUS_TYPES.has(b.workType) ? 0 : NICE_TO_DO_TYPES.has(b.workType) ? 1 : 0;
    if (aMain !== bMain) return aMain - bMain;
    if (a.workType === 'recovery' && b.workType !== 'recovery') return -1;
    if (a.workType !== 'recovery' && b.workType === 'recovery') return 1;
    return a.startMinutes - b.startMinutes;
  };

  const sorted = [...incompleteTasks].sort(sortForSuggested);
  const gapCopy = gaps.map((g) => ({ ...g, cursor: g.start }));

  const suggested: TaskBlock[] = [];
  for (const task of sorted) {
    const duration = task.endMinutes - task.startMinutes;
    const gap = gapCopy.find((g) => g.end - g.cursor >= duration);
    if (!gap) continue;
    const start = gap.cursor;
    const end = start + duration;
    gap.cursor = end;
    suggested.push({ ...task, startMinutes: start, endMinutes: end });
  }

  return suggested.sort((a, b) => a.startMinutes - b.startMinutes);
}

/** Find up to `count` free-gap start times (in minutes since midnight) that are
 *  ≥ minDuration minutes long and start at or after `afterMinutes`. */
function getRechargeSlots(
  events: { startMinutes: number; endMinutes: number }[],
  afterMinutes: number,
  minDuration: number,
  count: number,
): number[] {
  const DAY_START = 7 * 60;
  const DAY_END = 21 * 60;
  const sorted = [...events].sort((a, b) => a.startMinutes - b.startMinutes);
  const gaps: { start: number; end: number }[] = [];
  let prevEnd = DAY_START;
  for (const e of sorted) {
    if (e.startMinutes > prevEnd && e.startMinutes - prevEnd >= minDuration) {
      gaps.push({ start: prevEnd, end: e.startMinutes });
    }
    prevEnd = Math.max(prevEnd, e.endMinutes);
  }
  if (DAY_END > prevEnd && DAY_END - prevEnd >= minDuration) {
    gaps.push({ start: prevEnd, end: DAY_END });
  }

  const slots: number[] = [];
  for (const gap of gaps) {
    const start = Math.max(gap.start, afterMinutes);
    if (gap.end - start >= minDuration) {
      slots.push(start);
      if (slots.length >= count) break;
    }
  }
  return slots;
}

// ─── Data hook ────────────────────────────────────────────────────────────────

function useTodayData() {
  const today = getTodayStr();
  const { items } = useCalendarItems(today);

  return useMemo(() => {
    const dayItems = items; // already filtered by date in hook
    const events = dayItems
      .filter((i): i is CalendarItem & { type: 'event' } => i.type === 'event')
      .map((i) => i.data);
    const tasks = dayItems
      .filter((i): i is CalendarItem & { type: 'task' } => i.type === 'task')
      .map((i) => i.data);
    const incompleteTasks = tasks.filter((t) => !t.completed);

    const meetingMinutes = events.reduce((sum, e) => sum + (e.endMinutes - e.startMinutes), 0);

    // Main Focus and Nice to do from suggested schedule (times/order), not raw Google calendar
    const suggestedTasks = getSuggestedTasksForDay(dayItems);

    const mainFocusTasks = suggestedTasks
      .filter((t) => MAIN_FOCUS_TYPES.has(t.workType))
      .slice(0, 3);

    const unclassified = suggestedTasks.filter(
      (t) => !MAIN_FOCUS_TYPES.has(t.workType) && !NICE_TO_DO_TYPES.has(t.workType)
    );
    const mainFocusFinal = [...mainFocusTasks, ...unclassified].slice(0, 3);

    const recoveryMomentsTasks = suggestedTasks.filter((t) => t.workType === 'recovery');

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const rechargeSlots = getRechargeSlots(events, nowMinutes, 5, 2);

    return {
      meetingMinutes,
      mainFocusTasks: mainFocusFinal,
      recoveryMomentsTasks,
      allIncompleteCount: incompleteTasks.length,
      rechargeSlots,
    };
  }, [items, today]);
}


// ─── Entrance animation hook ──────────────────────────────────────────────────

const STAGGER_DELAY = 120;

function useEntranceAnims(count: number) {
  const anims = useRef(Array.from({ length: count }, () => new Animated.Value(0))).current;

  useEffect(() => {
    const sequence = anims.map((a, i) =>
      Animated.timing(a, {
        toValue: 1,
        duration: 420,
        delay: i * STAGGER_DELAY,
        easing: Easing.out(Easing.back(1.4)),
        useNativeDriver: true,
      })
    );
    Animated.stagger(STAGGER_DELAY, sequence).start();
  }, []);

  return anims;
}


// ─── Mood check-in card ───────────────────────────────────────────────────────

const MOODS = ['😄', '🙂', '😐', '😕', '😔', '😢'] as const;

function MoodCheckIn() {
  const { saveCheckin } = useMoodCheckin();
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState('');
  const expandAnim = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput>(null);

  const expand = () => {
    if (expanded) return;
    setExpanded(true);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Animated.timing(expandAnim, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start(() => inputRef.current?.focus());
  };

  const dismiss = () => {
    setExpanded(false);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    // Save to backend when user dismisses (fire-and-forget)
    if (selectedMood || text.trim()) {
      saveCheckin({
        date: getTodayStr(),
        moodEmoji: selectedMood,
        notes: text.trim(),
      }).catch((e) => console.warn('mood checkin save failed:', e));
    }
  };

  return (
    <Card variant="card" inset={false} style={styles.checkInWrap}>
      {/* Header row */}
      <View style={styles.checkInHeader}>
        <View style={styles.checkInHeaderLeft}>
          <Text style={styles.checkInTitle}>How are you feeling?</Text>
          <Text style={styles.checkInSub}>Tap a mood or dump your thoughts</Text>
        </View>
        {(selectedMood || text.length > 0) && (
          <Pressable
            onPress={() => {
              if (selectedMood || text.trim()) {
                saveCheckin({ date: getTodayStr(), moodEmoji: selectedMood, notes: text.trim() })
                  .catch(() => {});
              }
              setSelectedMood(null); setText(''); setExpanded(false);
            }}
            hitSlop={12}
          >
            <Ionicons name="close-circle" size={18} color={TEXT_TERTIARY} />
          </Pressable>
        )}
      </View>

      {/* Mood chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.moodRow}
        style={{ backgroundColor: 'transparent' }}
      >
        {MOODS.map((emoji) => {
          const active = selectedMood === emoji;
          return (
            <Pressable
              key={emoji}
              onPress={() => setSelectedMood(active ? null : emoji)}
              style={[styles.moodChip, active && styles.moodChipActive]}
            >
              <Text style={styles.moodEmoji}>{emoji}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Write area */}
      {!expanded ? (
        <Pressable style={styles.writePrompt} onPress={expand}>
          <Text style={styles.writePromptText}>Be honest to yourself, we're not your boss</Text>
        </Pressable>
      ) : (
        <View style={styles.writeExpanded}>
          <View style={styles.writeInputWrap}>
            <TextInput
              ref={inputRef}
              style={styles.writeInput}
              placeholder="Be honest to yourself, we're not your boss"
              placeholderTextColor={colors.ink.placeholder}
              multiline
              value={text}
              onChangeText={setText}
              onBlur={dismiss}
            />
            <Pressable style={styles.micBtn} hitSlop={8}>
              <Ionicons name="mic-outline" size={18} color={TEXT_TERTIARY} />
            </Pressable>
          </View>
          {text.length > 0 && (
            <Pressable style={styles.logBtn} onPress={dismiss}>
              <Text style={styles.logBtnText}>Done</Text>
            </Pressable>
          )}
        </View>
      )}
    </Card>
  );
}

// ─── Daily Summary Card ───────────────────────────────────────────────────────

function DailySummaryCard({ summary }: { summary: string }) {
  return (
    <View style={dscStyles.card}>
      <View style={dscStyles.headingRow}>
        <Ionicons name="sunny-outline" size={13} color={TEXT_TERTIARY} style={{ marginTop: 1 }} />
        <Text style={dscStyles.heading}>Daily Summary</Text>
      </View>
      <Text style={dscStyles.body}>{summary}</Text>
    </View>
  );
}

const dscStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface.card,
    borderRadius: borderRadius.card,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface.cardBorder,
    marginBottom: 20,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  heading: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: fonts.bodyMedium,
    color: TEXT_TERTIARY,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  body: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: fonts.bodyRegular,
    color: TEXT_SECONDARY,
  },
});

// ─── This Week Card ───────────────────────────────────────────────────────────

// WEEK_DATA is now loaded from the backend via useWeeklyStats() — see ProgressCard

const BAR_MAX_H = 64;
const COLOR_BODY_BATTERY = palette.accentYellow;      // #FFD93D — energy stored
const COLOR_RECOVERY = palette.accentOrangeLight;     // #FFB66C — softer, restorative
const COLOR_WORKLOAD = palette.accentOrange;          // #FF8400 — effort / intensity

type WeekDay = { day: string; bodyBattery: number; recovery: number; workload: number };
function getWeekInsight(data: WeekDay[]): string {
  const batteries = data.map((d) => d.bodyBattery);
  const avgBattery = batteries.reduce((a, b) => a + b, 0) / batteries.length;
  const highDays = batteries.filter((v) => v >= 0.70).length;
  const avgWorkload = data.reduce((a, d) => a + d.workload, 0) / data.length;
  const avgRecovery = data.reduce((a, d) => a + d.recovery, 0) / data.length;
  const variance = batteries.reduce((a, b) => a + Math.abs(b - avgBattery), 0) / batteries.length;

  if (highDays >= 5 && variance < 0.12) {
    return 'Body Battery stayed strong all week — your energy rhythm is consistent and stable.';
  }
  if (avgWorkload >= 0.70 && avgBattery < 0.65) {
    return 'Heavy workload week with battery running low — recovery windows will be key to rebounding.';
  }
  if (highDays >= 5) {
    return `You were above 70 on ${highDays} of 7 days — strong output week with a few dips to watch.`;
  }
  if (avgRecovery >= 0.20) {
    return 'Recovery moments are working — your recharge windows are lifting daily energy over time.';
  }
  if (avgBattery < 0.60) {
    return 'Energy ran low this week — prioritise sleep and shorter focus blocks to rebuild baseline.';
  }
  return 'A mixed week — battery was steady mid-week but tapered at the edges. Keep recharge windows in.';
}

function getDayAnalysis(d: WeekDay) {
  const battPct = Math.round(d.bodyBattery * 100);
  const recPct = Math.round(d.recovery * 100);
  const loadPct = Math.round(d.workload * 100);

  const battLabel = d.bodyBattery >= 0.75 ? 'High' : d.bodyBattery >= 0.55 ? 'Moderate' : 'Low';
  const recLabel = d.recovery >= 0.25 ? 'Good' : d.recovery >= 0.15 ? 'Moderate' : 'Low';
  const loadLabel = d.workload >= 0.75 ? 'Heavy' : d.workload >= 0.45 ? 'Moderate' : 'Light';

  let summary: string;
  if (d.bodyBattery >= 0.70 && d.workload >= 0.75) {
    summary = 'High battery met heavy workload — you pushed hard. Protect recovery the following day.';
  } else if (d.bodyBattery >= 0.70 && d.workload < 0.40) {
    summary = 'Energy was high and load was light — a great day to have kept your reserves topped up.';
  } else if (d.bodyBattery < 0.60 && d.workload >= 0.70) {
    summary = 'Low battery under heavy load — a tough combination. Watch for fatigue carrying into the next day.';
  } else if (d.recovery >= 0.25) {
    summary = 'Recovery windows made a visible difference here. Energy held up well against the day\'s demands.';
  } else if (d.recovery < 0.12) {
    summary = 'Recovery was minimal. Even short recharge breaks have a compounding effect over the week.';
  } else {
    summary = 'A balanced day — battery and workload were in reasonable proportion with each other.';
  }

  return { battPct, recPct, loadPct, battLabel, recLabel, loadLabel, summary };
}

// ─── Workload line graph overlay ──────────────────────────────────────────────

function WorkloadLine({ data, chartWidth }: { data: WeekDay[]; chartWidth: number }) {
  if (chartWidth === 0) return null;

  const n = data.length;
  // Column width accounting for gaps between columns
  const colW = (chartWidth - (n - 1) * 6) / n;
  // X center for each day column
  const xs = data.map((_, i) => i * (colW + 6) + colW / 2);
  // Y position from top: 0 = top of bar area, BAR_MAX_H = bar floor
  const ys = data.map((d) => BAR_MAX_H * (1 - d.workload));

  return (
    <View
      style={{ position: 'absolute', top: 0, left: 0, width: chartWidth, height: BAR_MAX_H }}
      pointerEvents="none"
    >
      {/* Line segments between consecutive points */}
      {xs.slice(0, -1).map((x1, i) => {
        const y1 = ys[i];
        const x2 = xs[i + 1];
        const y2 = ys[i + 1];
        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        return (
          <View
            key={`seg-${i}`}
            style={{
              position: 'absolute',
              left: (x1 + x2) / 2 - length / 2,
              top: (y1 + y2) / 2 - 1,
              width: length,
              height: 2,
              backgroundColor: COLOR_WORKLOAD,
              borderRadius: 1,
              transform: [{ rotate: `${angle}deg` }],
            }}
          />
        );
      })}
      {/* Dots at each data point */}
      {xs.map((x, i) => (
        <View
          key={`dot-${i}`}
          style={{
            position: 'absolute',
            left: x - 3.5,
            top: ys[i] - 3.5,
            width: 7,
            height: 7,
            borderRadius: 3.5,
            backgroundColor: COLOR_WORKLOAD,
            borderWidth: 1.5,
            borderColor: colors.surface.card,
          }}
        />
      ))}
    </View>
  );
}

// ─── Progress card ────────────────────────────────────────────────────────────

function ProgressCard() {
  const { weekData } = useWeeklyStats(getWeekMonday());
  const insight = getWeekInsight(weekData);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [chartWidth, setChartWidth] = useState(0);

  const handleDayPress = (index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedDay((prev) => (prev === index ? null : index));
  };

  const analysis = selectedDay !== null ? getDayAnalysis(weekData[selectedDay]) : null;

  return (
    <View style={progressStyles.card}>
      {/* Header */}
      <View style={progressStyles.headingRow}>
        <View style={progressStyles.headingLeft}>
          <Ionicons name="bar-chart-outline" size={13} color={TEXT_TERTIARY} style={{ marginTop: 1 }} />
          <Text style={progressStyles.heading}>This Week</Text>
        </View>
        {/* Legend */}
        <View style={progressStyles.legendRow}>
          <View style={progressStyles.legendLine} />
          <Text style={progressStyles.legendText}>Workload</Text>
          <View style={[progressStyles.legendDot, { backgroundColor: COLOR_BODY_BATTERY }]} />
          <Text style={progressStyles.legendText}>Body Battery</Text>
          <View style={[progressStyles.legendDot, { backgroundColor: COLOR_RECOVERY }]} />
          <Text style={progressStyles.legendText}>Recovery</Text>
        </View>
      </View>

      {/* Chart — bar columns + workload line overlay */}
      <View
        onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}
        style={{ position: 'relative' }}
      >
        <View style={progressStyles.chartRow}>
          {weekData.map((d, i) => {
            const battH = Math.round(BAR_MAX_H * d.bodyBattery);
            const recH = Math.round(BAR_MAX_H * d.recovery);
            const isSelected = selectedDay === i;
            return (
              <Pressable
                key={d.day}
                style={[progressStyles.chartCol, isSelected && progressStyles.chartColSelected]}
                onPress={() => handleDayPress(i)}
              >
                <LinearGradient
                  colors={['rgba(255,232,122,0.55)', 'rgba(255,217,61,0.38)', 'rgba(255,187,0,0.25)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={[progressStyles.barBattery, { height: battH }]}
                >
                  <View style={[progressStyles.barRecovery, { height: recH }]} />
                </LinearGradient>
                <Text style={[progressStyles.dayLabel, isSelected && progressStyles.dayLabelSelected]}>
                  {d.day}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <WorkloadLine data={weekData} chartWidth={chartWidth} />
      </View>

      {/* Tap hint */}
      {selectedDay === null && (
        <Text style={progressStyles.tapHint}>Tap a day for details</Text>
      )}

      {/* Day detail panel */}
      {analysis !== null && selectedDay !== null && (
        <View style={progressStyles.dayDetail}>
          <View style={progressStyles.dayDetailHeader}>
            <Text style={progressStyles.dayDetailDay}>{weekData[selectedDay].day}</Text>
            <Pressable onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setSelectedDay(null); }} hitSlop={10}>
              <Ionicons name="close" size={14} color={TEXT_TERTIARY} />
            </Pressable>
          </View>
          <View style={progressStyles.dayDetailStats}>
            <View style={progressStyles.dayDetailStat}>
              <View style={[progressStyles.dayDetailDot, { backgroundColor: COLOR_BODY_BATTERY }]} />
              <Text style={progressStyles.dayDetailLabel}>Body Battery</Text>
              <Text style={progressStyles.dayDetailVal}>{analysis.battPct}% · {analysis.battLabel}</Text>
            </View>
            <View style={progressStyles.dayDetailStat}>
              <View style={[progressStyles.dayDetailDot, { backgroundColor: COLOR_RECOVERY }]} />
              <Text style={progressStyles.dayDetailLabel}>Recovery</Text>
              <Text style={progressStyles.dayDetailVal}>{analysis.recPct}% · {analysis.recLabel}</Text>
            </View>
            <View style={progressStyles.dayDetailStat}>
              <View style={[progressStyles.dayDetailDot, { backgroundColor: COLOR_WORKLOAD }]} />
              <Text style={progressStyles.dayDetailLabel}>Workload</Text>
              <Text style={progressStyles.dayDetailVal}>{analysis.loadPct}% · {analysis.loadLabel}</Text>
            </View>
          </View>
          <View style={progressStyles.dayDetailSummaryRow}>
            <Ionicons name="sparkles" size={11} color={TEXT_TERTIARY} style={{ marginTop: 1 }} />
            <Text style={progressStyles.dayDetailSummary}>{analysis.summary}</Text>
          </View>
        </View>
      )}

      {/* Week insight (hidden while a day is selected) */}
      {selectedDay === null && (
        <View style={progressStyles.insightRow}>
          <Ionicons name="sparkles" size={11} color={TEXT_TERTIARY} style={{ marginTop: 1 }} />
          <Text style={progressStyles.insightText}>{insight}</Text>
        </View>
      )}
    </View>
  );
}

const progressStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface.card,
    borderRadius: borderRadius.card,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface.cardBorder,
    marginBottom: 20,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  heading: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: fonts.bodyMedium,
    color: TEXT_TERTIARY,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    height: BAR_MAX_H + 16,
    marginBottom: 4,
  },
  chartCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    borderRadius: 4,
    paddingTop: 2,
  },
  chartColSelected: {
    backgroundColor: `${COLOR_WORKLOAD}18`,
  },
  barBattery: {
    width: '100%',
    borderRadius: 3,
    minHeight: 3,
    position: 'relative',
    justifyContent: 'flex-start',
  },
  barRecovery: {
    position: 'absolute',
    bottom: 0,
    left: '15%',
    right: '15%',
    backgroundColor: COLOR_RECOVERY,
    borderRadius: 2,
    minHeight: 3,
  },
  dayLabel: {
    fontSize: 9,
    fontFamily: fonts.bodyLight,
    color: TEXT_TERTIARY,
    letterSpacing: 0.2,
  },
  dayLabelSelected: {
    color: COLOR_WORKLOAD,
    fontFamily: fonts.bodyMedium,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  legendLine: {
    width: 12,
    height: 2,
    borderRadius: 1,
    backgroundColor: COLOR_WORKLOAD,
  },
  legendText: {
    fontSize: 10,
    fontFamily: fonts.bodyLight,
    color: TEXT_TERTIARY,
    marginRight: 4,
  },
  tapHint: {
    fontSize: 10,
    fontFamily: fonts.bodyLight,
    color: TEXT_TERTIARY,
    textAlign: 'center',
    marginBottom: 8,
    opacity: 0.6,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.surface.cardBorder,
  },
  insightText: {
    flex: 1,
    fontSize: 12,
    fontFamily: fonts.bodyLight,
    color: TEXT_SECONDARY,
    lineHeight: 17,
  },
  /* Day detail panel */
  dayDetail: {
    marginTop: 6,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.surface.cardBorder,
    gap: 10,
  },
  dayDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayDetailDay: {
    fontSize: typography.cardTitle.fontSize,
    lineHeight: typography.cardTitle.lineHeight,
    fontFamily: fonts.bodyMedium,
    color: TEXT_PRIMARY,
  },
  dayDetailStats: {
    gap: 7,
  },
  dayDetailStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  dayDetailDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  dayDetailLabel: {
    fontSize: 12,
    fontFamily: fonts.bodyLight,
    color: TEXT_SECONDARY,
    flex: 1,
  },
  dayDetailVal: {
    fontSize: 12,
    fontFamily: fonts.bodyMedium,
    color: TEXT_PRIMARY,
  },
  dayDetailSummaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
  },
  dayDetailSummary: {
    flex: 1,
    fontSize: 12,
    fontFamily: fonts.bodyLight,
    color: TEXT_SECONDARY,
    lineHeight: 17,
  },
});

// ─── Home screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [animationOpen, setAnimationOpen] = useState(false);
  const [profileName] = useState('Pre');

  const today = getTodayStr();
  const { meetingMinutes, allIncompleteCount, rechargeSlots } = useTodayData();
  const { energyByHour } = useEnergy(today);
  const { summary: dailySummaryData } = useDailySummary(today);
  const capacity = getCapacity(allIncompleteCount, meetingMinutes);

  // Use micro-break hours from energy forecast as recharge slots when available
  const energyRechargeSlots = Object.entries(energyByHour)
    .filter(([, v]) => v.isMicroBreak)
    .map(([h]) => parseInt(h) * 60);
  const finalRechargeSlots = energyRechargeSlots.length > 0
    ? energyRechargeSlots.slice(0, 2)
    : rechargeSlots;

  const bottomPadding = insets.bottom + TAB_BAR_HEIGHT + BEE_AREA_HEIGHT + spacing.md;

  // 5 animated slots: header, metrics, moodCheckIn, mainFocus, recoveryMoments
  const entranceAnims = useEntranceAnims(6);

  const entranceStyle = (index: number) => ({
    opacity: entranceAnims[index],
    transform: [
      {
        translateY: entranceAnims[index].interpolate({
          inputRange: [0, 1],
          outputRange: [18, 0],
        }),
      },
    ],
  });

  const greeting = getGreeting();
  const dateStr = formatDate();
  const isEmpty = allIncompleteCount === 0;

  return (
    <AppBackground>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.container,
          { paddingTop: 20, paddingBottom: bottomPadding },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ───────────────────────────────────────────────────── */}
        <Animated.View style={[styles.headerRow, entranceStyle(0)]}>
          <Pressable style={styles.profileCircle} onPress={() => router.push('/settings')} hitSlop={8}>
            <Text style={styles.profileInitial}>
              {profileName.trim().charAt(0).toUpperCase() || 'P'}
            </Text>
          </Pressable>
          <View style={styles.headerLeft}>
            <Text style={styles.greetingText}>{greeting}</Text>
            <Text style={styles.nameText}>{profileName}</Text>
          </View>
          <Text style={styles.dateText}>{dateStr}</Text>
        </Animated.View>

        {/* ── Workload + Capacity metrics ──────────────────────────────── */}
        {!isEmpty && (
          <Animated.View style={entranceStyle(1)}>
            <View style={styles.metricsRow}>
              <Card variant="card" inset={false} style={styles.metricCard}>
                <View style={styles.metricInner}>
                  <View style={styles.metricIconRow}>
                    <Ionicons name="layers-outline" size={14} color={TEXT_TERTIARY} />
                    <Text style={styles.metricLabel}>Workload</Text>
                  </View>
                  <Text style={styles.metricValue}>{allIncompleteCount}</Text>
                  <Text style={styles.metricSub}>
                    {allIncompleteCount === 1 ? 'task' : 'tasks'} · {Math.round(meetingMinutes / 60)}h meetings
                  </Text>
                </View>
              </Card>

              <Card variant="card" inset={false} style={styles.metricCard}>
                <View style={styles.metricInner}>
                  <View style={styles.metricIconRow}>
                    <Ionicons name="battery-charging-outline" size={14} color={TEXT_TERTIARY} />
                    <Text style={styles.metricLabel}>Capacity</Text>
                  </View>
                  <Text style={styles.metricValue}>{capacity}</Text>
                  <Text style={styles.metricSub}>tasks recommended</Text>
                </View>
              </Card>
            </View>

            <DailySummaryCard summary={dailySummaryData.summaryText} />
          </Animated.View>
        )}

        {/* ── Mood check-in ─────────────────────────────────────────── */}
        <Animated.View style={entranceStyle(2)}>
          <MoodCheckIn />
        </Animated.View>

        {/* ── Content ──────────────────────────────────────────────────── */}
        {isEmpty ? (
          <Animated.View style={[styles.emptyWrap, entranceStyle(1)]}>
            <Text style={styles.emptyTitle}>All clear</Text>
            <Text style={styles.emptySubtitle}>Add tasks in the Calendar tab to see them here</Text>
          </Animated.View>
        ) : (
          <View style={styles.sectionsWrap}>
            <Animated.View style={entranceStyle(4)}>
              <RecoveryMomentsCard rechargeSlots={finalRechargeSlots} />
            </Animated.View>
            <Animated.View style={entranceStyle(5)}>
              <ProgressCard />
            </Animated.View>
          </View>
        )}
      </ScrollView>
      </SafeAreaView>

      <AnimationPullUp onPress={() => setAnimationOpen(true)} />
      <AnimationScreen visible={animationOpen} onClose={() => setAnimationOpen(false)} />
    </AppBackground>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const ROW_DIVIDER = colors.divider.subtle;

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scroll: { flex: 1 },
  container: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },

  /* ── Header ── */
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  profileCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.accentOrange,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  profileInitial: {
    fontSize: 15,
    fontFamily: fonts.bodyMedium,
    color: '#fff',
  },
  headerLeft: { gap: 2, flex: 1 },
  greetingText: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: fonts.bodyRegular,
    color: TEXT_SECONDARY,
  },
  nameText: {
    fontSize: typography.sectionHeader.fontSize,
    lineHeight: typography.sectionHeader.lineHeight,
    fontFamily: fonts.display,
    color: TEXT_PRIMARY,
    letterSpacing: 0,
  },
  dateText: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: fonts.bodyLight,
    color: TEXT_TERTIARY,
    marginTop: 4,
  },

  /* ── Metric cards ── */
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  metricCard: {
    flex: 1,
    borderRadius: borderRadius.card,
    overflow: 'hidden',
  },
  metricInner: {
    padding: 16,
    gap: 4,
  },
  metricIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: fonts.bodyLight,
    color: TEXT_TERTIARY,
    letterSpacing: 0.2,
  },
  metricValue: {
    fontSize: 34,
    lineHeight: 38,
    fontFamily: fonts.display,
    color: TEXT_PRIMARY,
    letterSpacing: -0.5,
  },
  metricSub: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.bodyLight,
    color: TEXT_SECONDARY,
  },

  /* ── Day summary ── */
  summaryCard: {
    marginBottom: 20,
    borderRadius: borderRadius.card,
    overflow: 'hidden',
  },
  summaryInner: {
    padding: 14,
  },
  summaryText: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: fonts.bodyRegular,
    color: TEXT_SECONDARY,
  },

  /* ── Sections wrap ── */
  sectionsWrap: { gap: 12 },

  /* ── Section card ── */
  sectionWrap: {
    borderRadius: borderRadius.card,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  sectionLabel: {
    flex: 1,
    fontSize: typography.cardTitle.fontSize,
    lineHeight: typography.cardTitle.lineHeight,
    fontFamily: fonts.bodyMedium,
    color: TEXT_PRIMARY,
  },
  sectionCountBadge: {
    backgroundColor: colors.control.chipBg,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCount: {
    fontSize: 12,
    fontFamily: fonts.bodyMedium,
    color: TEXT_SECONDARY,
  },

  /* ── Grouped task card ── */
  taskGroup: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider.subtle,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider.subtle,
    marginLeft: 16,
  },

  /* ── Task row ── */
  taskRow: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
    alignItems: 'center',
  },
  taskRowRecovery: {
    backgroundColor: 'rgba(255, 217, 61, 0.06)',
  },

  /* Time column */
  timeCol: {
    width: 40,
    alignItems: 'center',
    gap: 3,
    paddingTop: 2,
  },
  timeStart: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: fonts.bodyLight,
    color: TEXT_SECONDARY,
  },
  timeLine: {
    width: 1,
    flex: 1,
    minHeight: 10,
    backgroundColor: ROW_DIVIDER,
  },
  timeEnd: {
    fontSize: 11,
    fontFamily: fonts.bodyLight,
    color: TEXT_SECONDARY,
  },

  /* Task content */
  taskContent: {
    flex: 1,
    gap: 5,
  },
  taskTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    position: 'relative',
  },
  taskTitle: {
    flex: 1,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: fonts.bodyMedium,
    color: TEXT_PRIMARY,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.divider.strong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  checkboxDone: {
    backgroundColor: palette.accentYellow,
    borderColor: palette.accentYellow,
  },
  taskChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: borderRadius.pill,
  },
  typeDot: { width: 5, height: 5, borderRadius: 3 },
  typeLabel: { fontSize: typography.caption.fontSize, fontFamily: fonts.bodyLight, color: colors.ink.secondary },
  durationLabel: {
    fontSize: 11,
    fontFamily: fonts.bodyLight,
    color: TEXT_TERTIARY,
  },

  pointsTag: {
    position: 'absolute',
    right: 0,
    top: -6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 217, 61, 0.18)',
  },
  pointsText: {
    fontSize: 11,
    fontFamily: fonts.bodyMedium,
    color: palette.accentOrange,
    letterSpacing: 0.2,
  },

  /* Subtasks */
  subtaskList: {
    gap: 5,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: ROW_DIVIDER,
    marginTop: 4,
  },
  subtaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subtaskDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.accentYellow,
  },
  subtaskText: { flex: 1, fontSize: 13, fontFamily: fonts.bodyRegular, color: TEXT_SECONDARY },
  subtaskDur: { fontSize: 11, fontFamily: fonts.bodyLight, color: TEXT_TERTIARY },

  /* Empty state */
  emptyWrap: {
    marginTop: 40,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: fonts.bodyMedium,
    color: TEXT_PRIMARY,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: fonts.bodyRegular,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 20,
  },

  /* ── Mood check-in ── */
  checkInWrap: {
    borderRadius: borderRadius.card,
    marginBottom: 12,
    overflow: 'hidden',
  },
  checkInHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  checkInHeaderLeft: { gap: 2 },
  checkInTitle: {
    fontSize: typography.cardTitle.fontSize,
    lineHeight: typography.cardTitle.lineHeight,
    fontFamily: fonts.bodyMedium,
    color: TEXT_PRIMARY,
  },
  checkInSub: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: fonts.bodyLight,
    color: TEXT_TERTIARY,
  },
  moodRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  moodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.control.chipBg,
    borderWidth: 1,
    borderColor: colors.control.chipBorder,
  },
  moodChipActive: {
    backgroundColor: 'rgba(255, 184, 0, 0.14)',
    borderColor: 'rgba(255, 184, 0, 0.38)',
  },
  moodEmoji: {
    fontSize: 15,
    lineHeight: 18,
  },
  writePrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginHorizontal: 16,
    marginBottom: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: borderRadius.input,
    backgroundColor: colors.control.chipBg,
    borderWidth: 1,
    borderColor: colors.control.chipBorder,
  },
  writePromptText: {
    fontSize: typography.caption.fontSize,
    fontFamily: fonts.bodyLight,
    color: TEXT_TERTIARY,
  },
  writeExpanded: {
    marginHorizontal: 16,
    marginBottom: 14,
    gap: 8,
  },
  writeInputWrap: {
    borderRadius: borderRadius.input,
    backgroundColor: colors.control.fieldBg,
    borderWidth: 1,
    borderColor: colors.control.fieldFocus,
    minHeight: 80,
  },
  writeInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 36,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: fonts.bodyRegular,
    color: TEXT_PRIMARY,
    textAlignVertical: 'top',
  },
  micBtn: {
    position: 'absolute',
    bottom: 8,
    right: 10,
  },
  logBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: borderRadius.button,
    backgroundColor: palette.accentOrange,
  },
  logBtnText: {
    fontSize: 13,
    fontFamily: fonts.bodyMedium,
    color: '#fff',
  },
});
