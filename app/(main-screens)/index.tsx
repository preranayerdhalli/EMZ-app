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
import type { SummaryFeedback } from '@/hooks/useDailySummary';
import { useMoodCheckin } from '@/hooks/useMoodCheckin';
import { colors, spacing, borderRadius, typography, fonts, palette } from '@/constants/theme';
import { Card } from '@/components/ui';
import type { CalendarItem } from '@/constants/calendarTypes';
import { useAuth } from '@/context/AuthContext';
import { usePostHog } from 'posthog-react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const TAB_BAR_HEIGHT = 64;
const BEE_AREA_HEIGHT = 112;


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

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const rechargeSlots = getRechargeSlots(events, nowMinutes, 5, 2);

    return {
      meetingMinutes,
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
  const posthog = usePostHog();
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
      posthog?.capture('mood_checkin_saved', {
        mood_emoji: selectedMood,
        has_notes: text.trim().length > 0,
      });
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

// ─── Daily Summary Card ───────────────────────────────��───────────────────────

function DailySummaryCard({
  summary,
  feedback,
  onFeedback,
}: {
  summary: string;
  feedback: SummaryFeedback | null;
  onFeedback: (v: SummaryFeedback) => void;
}) {
  return (
    <Card variant="card" inset={false} style={{ marginBottom: 20 }}>
      <View style={dscStyles.inner}>
      <View style={dscStyles.headingRow}>
        <Ionicons name="sunny-outline" size={13} color={TEXT_TERTIARY} style={{ marginTop: 1 }} />
        <Text style={dscStyles.heading}>Daily Summary</Text>
        <View style={dscStyles.feedbackRow}>
          <Pressable
            onPress={() => onFeedback('up')}
            hitSlop={8}
            style={[dscStyles.feedbackBtn, feedback === 'up' && dscStyles.feedbackBtnActive]}
          >
            <Ionicons
              name={feedback === 'up' ? 'thumbs-up' : 'thumbs-up-outline'}
              size={14}
              color={feedback === 'up' ? palette.accentOrange : TEXT_TERTIARY}
            />
          </Pressable>
          <Pressable
            onPress={() => onFeedback('down')}
            hitSlop={8}
            style={[dscStyles.feedbackBtn, feedback === 'down' && dscStyles.feedbackBtnActive]}
          >
            <Ionicons
              name={feedback === 'down' ? 'thumbs-down' : 'thumbs-down-outline'}
              size={14}
              color={feedback === 'down' ? colors.ink.secondary : TEXT_TERTIARY}
            />
          </Pressable>
        </View>
      </View>
      <Text style={dscStyles.body}>{summary}</Text>
      </View>
    </Card>
  );
}

const dscStyles = StyleSheet.create({
  inner: {
    padding: 14,
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
    flex: 1,
  },
  feedbackRow: {
    flexDirection: 'row',
    gap: 4,
  },
  feedbackBtn: {
    padding: 4,
    borderRadius: 6,
  },
  feedbackBtnActive: {
    backgroundColor: 'rgba(255,132,0,0.10)',
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

function ProgressCard({ isEmpty }: { isEmpty: boolean }) {
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
    <Card variant="card" inset={false} style={{ marginBottom: 20 }}>
    <View style={progressStyles.inner}>
      {/* Header */}
      <View style={progressStyles.headingBlock}>
        <View style={progressStyles.headingLeft}>
          <Ionicons name="bar-chart-outline" size={13} color={TEXT_TERTIARY} style={{ marginTop: 1 }} />
          <Text style={progressStyles.heading}>This Week</Text>
        </View>
        {/* Legend — shown only when data is available */}
        {!isEmpty && (
          <View style={progressStyles.legendRow}>
            <View style={progressStyles.legendLine} />
            <Text style={progressStyles.legendText}>Workload</Text>
            <View style={[progressStyles.legendDot, { backgroundColor: COLOR_BODY_BATTERY }]} />
            <Text style={progressStyles.legendText}>Body Battery</Text>
            <View style={[progressStyles.legendDot, { backgroundColor: COLOR_RECOVERY }]} />
            <Text style={progressStyles.legendText}>Recovery</Text>
          </View>
        )}
      </View>

      {/* Gathering data state */}
      {isEmpty && (
        <View style={progressStyles.gatheringWrap}>
          <Ionicons name="time-outline" size={20} color={TEXT_TERTIARY} />
          <Text style={progressStyles.gatheringTitle}>Gathering data</Text>
          <Text style={progressStyles.gatheringBody}>
            Your weekly summary will be ready once health and task data starts syncing.
          </Text>
        </View>
      )}

      {/* Chart — bar columns + workload line overlay */}
      {!isEmpty && <View
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
      </View>}

      {!isEmpty && <>
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
      </>}
    </View>
    </Card>
  );
}

const progressStyles = StyleSheet.create({
  inner: {
    padding: 14,
  },
  headingBlock: {
    flexDirection: 'column',
    marginBottom: 14,
    gap: 8,
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
  gatheringWrap: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  gatheringTitle: {
    fontSize: typography.cardTitle.fontSize,
    lineHeight: typography.cardTitle.lineHeight,
    fontFamily: fonts.bodyMedium,
    color: TEXT_SECONDARY,
  },
  gatheringBody: {
    fontSize: 13,
    fontFamily: fonts.bodyLight,
    color: TEXT_TERTIARY,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
  },
});

// ─── Home screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [animationOpen, setAnimationOpen] = useState(false);

  const profileName = (() => {
    const meta = user?.user_metadata as Record<string, unknown> | undefined;
    const full = (meta?.full_name ?? meta?.name ?? '') as string;
    return full.trim() || (user?.email ?? '').split('@')[0] || 'You';
  })();

  const today = getTodayStr();
  const { meetingMinutes, allIncompleteCount, rechargeSlots } = useTodayData();
  const { energyByHour } = useEnergy(today);
  const { summary: dailySummaryData, submitFeedback } = useDailySummary(today);
  const capacity = getCapacity(allIncompleteCount, meetingMinutes);

  // Use micro-break hours from energy forecast as recharge slots when available
  const energyRechargeSlots = Object.entries(energyByHour)
    .filter(([, v]) => v.isMicroBreak)
    .map(([h]) => parseInt(h) * 60);
  const finalRechargeSlots = energyRechargeSlots.length > 0
    ? energyRechargeSlots.slice(0, 2)
    : rechargeSlots;

  const bottomPadding = insets.bottom + TAB_BAR_HEIGHT + BEE_AREA_HEIGHT + spacing.md;

  const entranceAnims = useEntranceAnims(5);

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
        <Animated.View style={entranceStyle(1)}>
          <View style={styles.metricsRow}>
            <Card variant="card" inset={false} style={styles.metricCard}>
              <View style={styles.metricInner}>
                <View style={styles.metricIconRow}>
                  <Ionicons name="layers-outline" size={14} color={TEXT_TERTIARY} />
                  <Text style={styles.metricLabel}>Workload</Text>
                </View>
                <Text style={[styles.metricValue, isEmpty && styles.metricValueEmpty]}>
                  {isEmpty ? '—' : allIncompleteCount}
                </Text>
                <Text style={styles.metricSub}>
                  {isEmpty ? 'No tasks yet' : `${allIncompleteCount === 1 ? 'task' : 'tasks'} · ${Math.round(meetingMinutes / 60)}h meetings`}
                </Text>
              </View>
            </Card>

            <Card variant="card" inset={false} style={styles.metricCard}>
              <View style={styles.metricInner}>
                <View style={styles.metricIconRow}>
                  <Ionicons name="battery-charging-outline" size={14} color={TEXT_TERTIARY} />
                  <Text style={styles.metricLabel}>Capacity</Text>
                </View>
                <Text style={[styles.metricValue, isEmpty && styles.metricValueEmpty]}>
                  {isEmpty ? '—' : capacity}
                </Text>
                <Text style={styles.metricSub}>
                  {isEmpty ? 'Add tasks to calculate' : 'tasks recommended'}
                </Text>
              </View>
            </Card>
          </View>

          <DailySummaryCard
            summary={
              isEmpty
                ? 'Gathering data — your daily summary will appear once you have tasks and health data syncing.'
                : dailySummaryData.summaryText
            }
            feedback={isEmpty ? null : dailySummaryData.feedback}
            onFeedback={submitFeedback}
          />
        </Animated.View>

        {/* ── Mood check-in ─────────────────────────────────────────── */}
        <Animated.View style={entranceStyle(2)}>
          <MoodCheckIn />
        </Animated.View>

        {/* ── Recovery + Weekly ────────────────────────────────────────── */}
        <View style={styles.sectionsWrap}>
          <Animated.View style={entranceStyle(3)}>
            <RecoveryMomentsCard rechargeSlots={finalRechargeSlots} />
          </Animated.View>
          <Animated.View style={entranceStyle(4)}>
            <ProgressCard isEmpty={isEmpty} />
          </Animated.View>
        </View>
      </ScrollView>
      </SafeAreaView>

      <AnimationPullUp onPress={() => setAnimationOpen(true)} />
      <AnimationScreen visible={animationOpen} onClose={() => setAnimationOpen(false)} />
    </AppBackground>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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
  metricValueEmpty: {
    color: TEXT_TERTIARY,
    fontSize: 28,
  },
  metricSub: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.bodyLight,
    color: TEXT_SECONDARY,
  },

  /* ── Sections wrap ── */
  sectionsWrap: { gap: 12 },

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
