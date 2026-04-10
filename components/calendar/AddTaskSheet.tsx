import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  Image,
  LayoutAnimation,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, fonts, palette } from '@/constants/theme';
import { Button } from '@/components/ui';
import type { WorkType, Priority, TaskBlock } from '@/constants/calendarTypes';

export type Flexibility = 'today' | 'this_week' | 'flexible' | 'specific';

export type RepeatPreset = 'daily' | 'weekdays' | 'weekends' | 'custom';

export type TaskInput = {
  id?: string;
  title: string;
  workType: WorkType;
  priority: Priority;
  dueDate: Date;
  durationMinutes: number;
  flexibility: Flexibility;
  isProcrastinated: boolean;
  repeatEnabled?: boolean;
  /** 0 = Mon … 6 = Sun */
  repeatDays?: number[];
  repeatEndDate?: Date | null;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onSchedule: (task: TaskInput) => void;
  initialTask?: TaskBlock | null;
};

/* Work types: Deep Work, Creative, Admin, Chore, Recovery, Learning, Social */
const WORK_TYPES: { value: WorkType; label: string; color: string; bg: string }[] = [
  { value: 'deep',     label: 'Deep Work', color: '#FF8A3D', bg: 'rgba(255,138,61,0.15)' },
  { value: 'creative', label: 'Creative',  color: '#2F5D8C', bg: 'rgba(47,93,140,0.14)' },
  { value: 'admin',    label: 'Admin',     color: '#B8B0A6', bg: 'rgba(184,176,166,0.18)' },
  { value: 'chore',    label: 'Chore',     color: '#6FA66A', bg: 'rgba(111,166,106,0.15)' },
  { value: 'recovery', label: 'Recovery',  color: 'palette.accentYellow', bg: 'rgba(255,215,0,0.16)' },
  { value: 'learning', label: 'Learning',  color: '#D48A6A', bg: 'rgba(212,138,106,0.16)' },
  { value: 'social',   label: 'Social',    color: '#FFB36B', bg: 'rgba(255,179,107,0.16)' },
];

const FLEXIBILITY_OPTIONS: { value: Flexibility; label: string }[] = [
  { value: 'today',     label: 'Today' },
  { value: 'this_week', label: 'This week' },
  { value: 'flexible',  label: 'Flexible' },
  { value: 'specific',  label: 'Pick date' },
];

/** Duration presets (minutes). "custom" means use custom hours/mins. */
const DURATION_PRESETS: { key: string; label: string; minutes: number }[] = [
  { key: '15',  label: '15m',  minutes: 15 },
  { key: '30',  label: '30m',  minutes: 30 },
  { key: '45',  label: '45m',  minutes: 45 },
  { key: '60',  label: '1h',   minutes: 60 },
  { key: '90',  label: '1.5h', minutes: 90 },
  { key: '120', label: '2h',   minutes: 120 },
  { key: '180', label: '3h',   minutes: 180 },
  { key: '240', label: '4h',   minutes: 240 },
  { key: 'custom', label: 'Custom', minutes: 0 },
];

function clampNum(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

export type Subtask = { id: string; title: string; durationMinutes: number };

export type SubtaskOption = Subtask & { included: boolean };

/** Mock LLM breakdown — replace with real LLM call later. */
function mockBreakdown(taskTitle: string): Subtask[] {
  const t = taskTitle.toLowerCase().trim();
  if (t.includes('tax') || t.includes('return')) {
    return [
      { id: '1', title: 'Gather receipts and bank statements', durationMinutes: 15 },
      { id: '2', title: 'Log into tax portal', durationMinutes: 5 },
      { id: '3', title: 'Fill in income section', durationMinutes: 30 },
      { id: '4', title: 'Review and submit', durationMinutes: 20 },
    ];
  }
  if (t.includes('report') || t.includes('write')) {
    return [
      { id: '1', title: 'Outline main points', durationMinutes: 15 },
      { id: '2', title: 'Draft first section', durationMinutes: 25 },
      { id: '3', title: 'Draft rest and edit', durationMinutes: 30 },
      { id: '4', title: 'Final read and submit', durationMinutes: 10 },
    ];
  }
  if (t.includes('clean') || t.includes('tidy')) {
    return [
      { id: '1', title: 'Clear surfaces', durationMinutes: 10 },
      { id: '2', title: 'One room at a time', durationMinutes: 20 },
      { id: '3', title: 'Take out rubbish', durationMinutes: 5 },
    ];
  }
  // Generic: 3–4 bite-sized steps
  const words = taskTitle.split(/\s+/).filter(Boolean);
  const part = words.length >= 3 ? words.slice(0, 3).join(' ') : taskTitle.slice(0, 30);
  return [
    { id: '1', title: `Start: ${part}`, durationMinutes: 15 },
    { id: '2', title: `Next step`, durationMinutes: 20 },
    { id: '3', title: `Finish up`, durationMinutes: 15 },
  ];
}

function formatDur(m: number): string {
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return min ? `${h}h ${min}m` : `${h}h`;
}

function dueDateFromFlexibility(f: Flexibility, specificDate?: Date): Date {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0, 0);
  switch (f) {
    case 'today':
      return d;
    case 'this_week': {
      const day = now.getDay();
      const daysUntilFri = day <= 5 ? 5 - day : 6;
      const fri = new Date(now);
      fri.setDate(now.getDate() + daysUntilFri);
      fri.setHours(17, 0, 0, 0);
      return fri;
    }
    case 'flexible': {
      const next = new Date(now);
      next.setDate(next.getDate() + 7);
      next.setHours(17, 0, 0, 0);
      return next;
    }
    case 'specific':
      return specificDate ? new Date(specificDate.getFullYear(), specificDate.getMonth(), specificDate.getDate(), 9, 0, 0, 0) : d;
    default:
      return d;
  }
}

function formatWhen(f: Flexibility, specificDate?: Date): string {
  if (f === 'specific' && specificDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d0 = new Date(specificDate);
    d0.setHours(0, 0, 0, 0);
    if (d0.getTime() === today.getTime()) return 'Today';
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (d0.getTime() === tomorrow.getTime()) return 'Tomorrow';
    return specificDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }
  return FLEXIBILITY_OPTIONS.find((o) => o.value === f)?.label ?? f;
}

export function AddTaskSheet({ visible, onClose, onSchedule, initialTask }: Props) {
  const [what, setWhat] = useState('');
  const [workType, setWorkType] = useState<WorkType>('deep');
  const [flexibility, setFlexibility] = useState<Flexibility>('today');
  const [specificDate, setSpecificDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  });
  const [durationMinutesState, setDurationMinutesState] = useState(60);
  const [durationPresetKey, setDurationPresetKey] = useState<string>('60');
  const [isProcrastinated, setIsProcrastinated] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [procFlowStep, setProcFlowStep] = useState<'breakdown' | 'choose_first' | null>(null);
  const [subtasks, setSubtasks] = useState<SubtaskOption[]>([]);
  const procAnim = useRef(new Animated.Value(0)).current;

  // Repeat state
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [repeatDays, setRepeatDays] = useState<number[]>([]);
  const [repeatEndEnabled, setRepeatEndEnabled] = useState(false);
  const [showRepeatEndPicker, setShowRepeatEndPicker] = useState(false);
  const [repeatEndDate, setRepeatEndDate] = useState<Date>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d;
  });


  useEffect(() => {
    if (!visible) return;
    if (initialTask) {
      const mins = initialTask.endMinutes - initialTask.startMinutes;
      const d = new Date(initialTask.date + 'T00:00:00');
      setWhat(initialTask.title);
      setWorkType(initialTask.workType);
      setFlexibility('specific');
      setSpecificDate(d);
      setDurationMinutesState(mins > 0 ? mins : 60);
      setDurationPresetKey(mins === 15 || mins === 30 || mins === 60 ? String(mins) : 'custom');
      setIsProcrastinated(false);
      setDetailsExpanded(true);
      setProcFlowStep(null);
      setSubtasks([]);
      setRepeatEnabled(false);
      setRepeatDays([]);
      setRepeatEndEnabled(false);
      setShowRepeatEndPicker(false);
    } else {
      setWhat('');
      setWorkType('deep');
      setFlexibility('today');
      setDurationMinutesState(60);
      setDurationPresetKey('60');
      setIsProcrastinated(false);
      setDetailsExpanded(false);
      setProcFlowStep(null);
      setSubtasks([]);
      setRepeatEnabled(false);
      setRepeatDays([]);
      setRepeatEndEnabled(false);
      setShowRepeatEndPicker(false);
    }
  }, [visible, initialTask]);

  const toggleDetails = () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setDetailsExpanded((e) => !e);
  };

  const toggleProcrastinated = () => {
    const next = !isProcrastinated;
    setIsProcrastinated(next);
    Animated.spring(procAnim, {
      toValue: next ? 1 : 0,
      useNativeDriver: false,
      tension: 80,
      friction: 8,
    }).start();
  };

  const dueDate = dueDateFromFlexibility(flexibility, specificDate);

  const durationMinutes = Math.max(1, durationMinutesState);
  const customHours = Math.floor(durationMinutes / 60);
  const customMins = durationMinutes % 60;
  const setCustomDuration = (hours: number, mins: number) => {
    const total = hours * 60 + mins;
    setDurationMinutesState(Math.max(1, total));
    setDurationPresetKey('custom');
  };

  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const toggleRepeatDay = (d: number) =>
    setRepeatDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()
    );
  const applyRepeatPreset = (preset: 'daily' | 'weekdays' | 'weekends') => {
    if (preset === 'daily') setRepeatDays([0, 1, 2, 3, 4, 5, 6]);
    else if (preset === 'weekdays') setRepeatDays([0, 1, 2, 3, 4]);
    else setRepeatDays([5, 6]);
  };

  const handleSchedule = () => {
    if (!what.trim()) return;
    if (isProcrastinated) {
      const raw = mockBreakdown(what.trim());
      setSubtasks(raw.map((st) => ({ ...st, included: true })));
      setProcFlowStep('breakdown');
      return;
    }
    onSchedule({
      ...(initialTask?.id && { id: initialTask.id }),
      title: what.trim(),
      workType,
      priority: initialTask?.priority ?? 'medium',
      dueDate,
      durationMinutes,
      flexibility,
      isProcrastinated: false,
      repeatEnabled,
      repeatDays: repeatEnabled ? repeatDays : [],
      repeatEndDate: repeatEnabled && repeatEndEnabled ? repeatEndDate : null,
    });
    onClose();
  };

  const handleLooksGood = () => setProcFlowStep('choose_first');
  const handleEditBreakdown = () => setProcFlowStep(null);

  const toggleSubtaskIncluded = (id: string) => {
    setSubtasks((prev) => prev.map((s) => (s.id === id ? { ...s, included: !s.included } : s)));
  };
  const setSubtaskDuration = (id: string, durationMinutes: number) => {
    const clamped = clampNum(durationMinutes, 1, 480);
    setSubtasks((prev) => prev.map((s) => (s.id === id ? { ...s, durationMinutes: clamped } : s)));
  };
  const setSubtaskTitle = (id: string, title: string) => {
    setSubtasks((prev) => prev.map((s) => (s.id === id ? { ...s, title } : s)));
  };
  const addCustomSubtask = () => {
    setSubtasks((prev) => [
      ...prev,
      { id: `custom-${Date.now()}`, title: '', durationMinutes: 15, included: true },
    ]);
  };
  const removeSubtask = (id: string) => {
    setSubtasks((prev) => prev.filter((s) => s.id !== id));
  };

  const includedSubtasks = subtasks.filter((s) => s.included && s.title.trim().length > 0);

  const scheduleSubtask = (subtask: SubtaskOption) => {
    onSchedule({
      title: subtask.title,
      workType,
      priority: 'medium',
      dueDate,
      durationMinutes: subtask.durationMinutes,
      flexibility,
      isProcrastinated: true,
    });
    onClose();
  };

  const procBg = procAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255,255,255,0.05)', 'rgba(255,129,27,0.12)'],
  });
  const procBorder = procAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255,255,255,0.10)', 'rgba(255,129,27,0.45)'],
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.kav}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.handle} />
            <View style={styles.sheetHeader}>
              {procFlowStep ? (
                <Pressable onPress={() => setProcFlowStep(procFlowStep === 'choose_first' ? 'breakdown' : null)} style={styles.backBtn}>
                  <Ionicons name="chevron-back" size={20} color={colors.ink.secondary} />
                  <Text style={styles.backBtnText}>Back</Text>
                </Pressable>
              ) : (
                <Text style={styles.sheetTitle}>New Task</Text>
              )}
              <Pressable onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={18} color={colors.ink.tertiary} />
              </Pressable>
            </View>

            {procFlowStep ? (
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.body}
              >
                {procFlowStep === 'breakdown' && (
                  <View style={styles.breakdownStep}>
                    <Text style={styles.breakdownHeading}>Break it into steps</Text>
                    <Text style={styles.breakdownSub}>
                      Use the suggestions below, edit them, or add your own. Tick to include, set duration for each step.
                    </Text>
                    <View style={styles.subtaskList}>
                      {subtasks.map((st, i) => (
                        <View key={st.id} style={[styles.subtaskRow, i === subtasks.length - 1 && styles.subtaskRowLast, !st.included && styles.subtaskRowExcluded]}>
                          <Pressable
                            style={[styles.subtaskCheckbox, st.included && styles.subtaskCheckboxActive]}
                            onPress={() => toggleSubtaskIncluded(st.id)}
                          >
                            {st.included && <Ionicons name="checkmark" size={14} color={colors.bodyText} />}
                          </Pressable>
                          <TextInput
                            style={[styles.subtaskTitleInput, !st.included && styles.subtaskTitleExcluded]}
                            value={st.title}
                            onChangeText={(t) => setSubtaskTitle(st.id, t)}
                            placeholder="Step description"
                            placeholderTextColor={colors.placeholder}
                            numberOfLines={2}
                            editable={st.included}
                          />
                          <View style={styles.subtaskDurWrap}>
                            <TextInput
                              style={styles.subtaskDurInput}
                              value={String(st.durationMinutes)}
                              onChangeText={(t) => setSubtaskDuration(st.id, parseInt(t, 10) || 0)}
                              keyboardType="number-pad"
                              maxLength={3}
                              editable={st.included}
                            />
                            <Text style={styles.subtaskDurLabel}>min</Text>
                          </View>
                          <Pressable
                            onPress={() => removeSubtask(st.id)}
                            style={styles.subtaskRemoveBtn}
                            accessibilityLabel="Remove step"
                          >
                          <Ionicons name="trash-outline" size={18} color={colors.ink.tertiary} />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                    <Pressable style={styles.addStepBtn} onPress={addCustomSubtask}>
                      <Ionicons name="add-circle-outline" size={20} color={colors.primaryYellow} />
                      <Text style={styles.addStepBtnText}>Add a step</Text>
                    </Pressable>
                    <Text style={styles.doesThisLook}>Happy with these steps?</Text>
                    <View style={styles.breakdownActions}>
                      <Pressable
                        style={[styles.looksGoodBtn, includedSubtasks.length === 0 && styles.looksGoodBtnDisabled]}
                        onPress={handleLooksGood}
                        disabled={includedSubtasks.length === 0}
                      >
                        <Text style={styles.looksGoodBtnText}>
                          {includedSubtasks.length === 0 ? 'Select at least one' : 'Looks good'}
                        </Text>
                      </Pressable>
                      <Pressable style={styles.editBreakdownBtn} onPress={handleEditBreakdown}>
                        <Text style={styles.editBreakdownBtnText}>Back to task</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
                {procFlowStep === 'choose_first' && (
                  <View style={styles.chooseFirstStep}>
                    <Text style={styles.breakdownHeading}>Which part do you want to tackle first?</Text>
                    <Text style={styles.breakdownSub}>Schedule just one. The rest can wait.</Text>
                    <View style={styles.chooseFirstList}>
                      {includedSubtasks.map((st, i) => (
                        <View key={st.id} style={[styles.chooseFirstRow, i === includedSubtasks.length - 1 && styles.chooseFirstRowLast]}>
                          <View style={styles.subtaskBullet} />
                          <Text style={styles.subtaskTitle} numberOfLines={1}>{st.title}</Text>
                          <Text style={styles.chooseFirstDur}>{formatDur(st.durationMinutes)}</Text>
                          <Pressable style={styles.scheduleOneBtn} onPress={() => scheduleSubtask(st)}>
                            <Text style={styles.scheduleOneBtnText}>Schedule it</Text>
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </ScrollView>
            ) : (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.body}
            >
              {/* ── Chat-style input: Bee + bubble ──────────────────── */}
              <View style={styles.chatRow}>
                <Image
                  source={require('@/assets/images/bee.png')}
                  style={styles.beeChatLogo}
                  resizeMode="contain"
                  accessibilityLabel="EMZ assistant"
                />
                <View style={styles.bubbleWrap}>
                  <TextInput
                    style={styles.bubbleInput}
                    placeholder="What do you need to do?"
                    placeholderTextColor={colors.placeholder}
                    value={what}
                    onChangeText={setWhat}
                    autoFocus
                    multiline
                    accessibilityLabel="Tell EMZ your task"
                  />
                </View>
              </View>

              <Text style={styles.tellEmzCopy}>
                Tell EMZ your task (what, work type, energy required, duration of task and deadline). Or fill the details below.
              </Text>

              {/* ── Collapsible: Fill details manually ───────────────── */}
              <Pressable style={styles.dropdownTrigger} onPress={toggleDetails}>
                <Text style={styles.dropdownTriggerText}>
                  {detailsExpanded ? 'Hide details' : 'Fill details manually'}
                </Text>
                <Ionicons
                  name={detailsExpanded ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={colors.ink.tertiary}
                />
              </Pressable>

              {detailsExpanded && (
                <View style={styles.dropdownContent}>
                  <Text style={styles.sectionLabel}>When</Text>
                  <View style={styles.flexRow}>
                    {FLEXIBILITY_OPTIONS.map(({ value, label }) => (
                      <Pressable
                        key={value}
                        onPress={() => setFlexibility(value)}
                        style={[styles.flexPill, flexibility === value && styles.flexPillActive]}
                      >
                        <Text style={[styles.flexPillTxt, flexibility === value && styles.flexPillTxtActive]}>{label}</Text>
                      </Pressable>
                    ))}
                  </View>
                  {flexibility === 'specific' && (
                    <>
                      <Pressable style={styles.dateRow} onPress={() => setShowDatePicker(true)}>
                        <Ionicons name="calendar-outline" size={16} color={colors.ink.tertiary} />
                        <Text style={styles.dateRowTxt}>{formatWhen('specific', specificDate)}</Text>
                        <Ionicons name="chevron-forward" size={14} color={colors.ink.tertiary} />
                      </Pressable>
                      {showDatePicker && (
                        <DateTimePicker
                          value={specificDate}
                          mode="date"
                          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                          onChange={(_, d) => {
                            setShowDatePicker(Platform.OS === 'ios');
                            if (d) setSpecificDate(d);
                          }}
                          minimumDate={new Date()}
                        />
                      )}
                    </>
                  )}

                  <Text style={styles.sectionLabel}>How long</Text>
                  <View style={styles.durationPresetRow}>
                    {DURATION_PRESETS.map((p) => {
                      const isCustom = p.key === 'custom';
                      const isSelected = durationPresetKey === p.key;
                      return (
                        <Pressable
                          key={p.key}
                          onPress={() => {
                            if (isCustom) {
                              setDurationPresetKey('custom');
                            } else {
                              setDurationPresetKey(p.key);
                              setDurationMinutesState(p.minutes);
                            }
                          }}
                          style={[styles.durationPresetChip, isSelected && styles.durationPresetChipActive]}
                        >
                          <Text style={[styles.durationPresetChipText, isSelected && styles.durationPresetChipTextActive]}>
                            {p.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {durationPresetKey === 'custom' && (
                    <View style={styles.durationCustomRow}>
                      <View style={styles.durationCustomField}>
                        <Text style={styles.durationCustomLabel}>Hours</Text>
                        <TextInput
                          style={styles.durationCustomInput}
                          value={String(customHours)}
                          onChangeText={(t) => setCustomDuration(clampNum(parseInt(t, 10) || 0, 0, 99), customMins)}
                          keyboardType="number-pad"
                          maxLength={2}
                          placeholder="0"
                          placeholderTextColor={colors.placeholder}
                        />
                      </View>
                      <View style={styles.durationCustomField}>
                        <Text style={styles.durationCustomLabel}>Minutes</Text>
                        <TextInput
                          style={styles.durationCustomInput}
                          value={String(customMins)}
                          onChangeText={(t) => setCustomDuration(customHours, clampNum(parseInt(t, 10) || 0, 0, 59))}
                          keyboardType="number-pad"
                          maxLength={2}
                          placeholder="0"
                          placeholderTextColor={colors.placeholder}
                        />
                      </View>
                      <Text style={styles.durationCustomSummary}>
                        = {durationMinutes < 60 ? `${durationMinutes} min` : `${customHours}h ${customMins > 0 ? `${customMins}m` : ''}`.trim()}
                      </Text>
                    </View>
                  )}
                  {durationPresetKey !== 'custom' && (
                    <Text style={styles.durationSummary}>
                      {durationMinutes < 60 ? `${durationMinutes} min` : `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60 > 0 ? `${durationMinutes % 60}m` : ''}`.trim()}
                    </Text>
                  )}

                  <Text style={styles.sectionLabel}>Work type</Text>
                  <View style={styles.chipRow}>
                    {WORK_TYPES.map(({ value, label, color, bg }) => {
                      const active = workType === value;
                      return (
                        <Pressable
                          key={value}
                          onPress={() => setWorkType(value)}
                          style={[styles.chip, { borderColor: active ? color + '80' : 'rgba(255,255,255,0.12)' }, active && { backgroundColor: bg }]}
                        >
                          <Text style={[styles.chipTxt, active && { color }]}>{label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {/* ── Repeat ────────────────────────────────────────── */}
                  <View style={styles.repeatSection}>
                    {/* Toggle row */}
                    <Pressable style={styles.repeatToggleRow} onPress={() => setRepeatEnabled((v) => !v)}>
                      <Ionicons
                        name="repeat"
                        size={18}
                        color={repeatEnabled ? colors.brandGold : colors.ink.tertiary}
                      />
                      <Text style={[styles.repeatToggleLabel, repeatEnabled && styles.repeatToggleLabelActive]}>
                        Repeat
                      </Text>
                      <View style={[styles.repeatToggle, repeatEnabled && styles.repeatToggleOn]}>
                        <View style={[styles.repeatToggleThumb, repeatEnabled && styles.repeatToggleThumbOn]} />
                      </View>
                    </Pressable>

                    {repeatEnabled && (
                      <View style={styles.repeatExpanded}>
                        {/* Presets */}
                        <View style={styles.repeatPresetRow}>
                          {(['daily', 'weekdays', 'weekends'] as const).map((preset) => {
                            const labels = { daily: 'Every day', weekdays: 'Weekdays', weekends: 'Weekends' };
                            const matches = {
                              daily: repeatDays.length === 7,
                              weekdays: repeatDays.length === 5 && !repeatDays.includes(5) && !repeatDays.includes(6),
                              weekends: repeatDays.length === 2 && repeatDays.includes(5) && repeatDays.includes(6),
                            };
                            return (
                              <Pressable
                                key={preset}
                                style={[styles.repeatPresetChip, matches[preset] && styles.repeatPresetChipActive]}
                                onPress={() => applyRepeatPreset(preset)}
                              >
                                <Text style={[styles.repeatPresetChipText, matches[preset] && styles.repeatPresetChipTextActive]}>
                                  {labels[preset]}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>

                        {/* Day chips */}
                        <View style={styles.repeatDayRow}>
                          {DAYS.map((label, idx) => {
                            const active = repeatDays.includes(idx);
                            return (
                              <Pressable
                                key={idx}
                                style={[styles.repeatDayChip, active && styles.repeatDayChipActive]}
                                onPress={() => toggleRepeatDay(idx)}
                              >
                                <Text style={[styles.repeatDayChipText, active && styles.repeatDayChipTextActive]}>
                                  {label[0]}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>

                        {/* End date toggle */}
                        <View style={styles.repeatEndRow}>
                          <Pressable
                            style={styles.repeatEndToggle}
                            onPress={() => {
                              if (repeatEndEnabled && showRepeatEndPicker) {
                                setRepeatEndEnabled(false);
                                setShowRepeatEndPicker(false);
                              } else if (repeatEndEnabled && !showRepeatEndPicker) {
                                setShowRepeatEndPicker(true);
                              } else {
                                setRepeatEndEnabled(true);
                                setShowRepeatEndPicker(true);
                              }
                            }}
                          >
                            <Text style={styles.repeatEndLabel}>Ends</Text>
                            <Text style={[styles.repeatEndValue, repeatEndEnabled && styles.repeatEndValueActive]}>
                              {repeatEndEnabled
                                ? repeatEndDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
                                : 'Never'}
                            </Text>
                            <Ionicons name="chevron-forward" size={14} color={colors.ink.tertiary} />
                          </Pressable>
                        </View>
                        {repeatEndEnabled && showRepeatEndPicker && (
                          <DateTimePicker
                            value={repeatEndDate}
                            mode="date"
                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                            onChange={(_, d) => {
                              if (Platform.OS !== 'ios') setShowRepeatEndPicker(false);
                              if (d) setRepeatEndDate(d);
                            }}
                            minimumDate={new Date()}
                          />
                        )}
                      </View>
                    )}
                  </View>

                  <Animated.View style={[styles.procRow, { backgroundColor: procBg, borderColor: procBorder }]}>
                    <Pressable style={styles.procInner} onPress={toggleProcrastinated}>
                      <Ionicons name="flame-outline" size={22} color={colors.orange} />
                      <View style={styles.procText}>
                        <Text style={[styles.procTitle, isProcrastinated && styles.procTitleActive]}>I've been putting this off</Text>
                        <Text style={styles.procSub}>
                          {isProcrastinated ? "We'll break it into small steps, then you pick one to schedule" : 'Tap if you keep skipping this'}
                        </Text>
                      </View>
                      <View style={[styles.checkbox, isProcrastinated && styles.checkboxActive]}>
                        {isProcrastinated && <Ionicons name="checkmark" size={13} color={colors.bodyText} />}
                      </View>
                    </Pressable>
                  </Animated.View>
                </View>
              )}

              <Button
                label={isProcrastinated ? 'Break it down' : 'Schedule it'}
                onPress={handleSchedule}
                disabled={!what.trim()}
                left={<Ionicons name="flash" size={16} color={colors.ink.primary} />}
                style={[styles.scheduleBtn, !what.trim() && styles.scheduleBtnDisabled]}
              />
            </ScrollView>
            )}
          </Pressable>
        </KeyboardAvoidingView>
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
  kav: { justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface.sheet,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
    borderTopWidth: 1,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface.sheetBorder,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.divider.strong,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: 10,
    paddingBottom: 6,
  },
  sheetTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.2, color: colors.ink.primary },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingRight: 8,
  },
  backBtnText: { fontSize: 16, fontWeight: '650', color: colors.ink.secondary },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.control.chipBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { paddingHorizontal: spacing.lg, paddingBottom: 40 },

  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  beeChatLogo: {
    width: 36,
    height: 36,
    flexShrink: 0,
  },
  bubbleWrap: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    backgroundColor: colors.control.fieldBg,
    borderRadius: 18,
    borderTopLeftRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.control.fieldBorder,
  },
  bubbleInput: {
    fontSize: 15,
    fontFamily: fonts.bodyRegular,
    color: colors.ink.primary,
    minHeight: 22,
    padding: 0,
    lineHeight: 21,
  },
  tellEmzCopy: {
    fontSize: 13,
    color: colors.ink.secondary,
    lineHeight: 19,
    marginBottom: 16,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    backgroundColor: colors.control.chipBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.control.chipBorder,
  },
  dropdownTriggerText: {
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
    color: colors.ink.primary,
  },
  dropdownContent: {
    marginBottom: 20,
    paddingTop: 4,
  },

  sectionLabel: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontWeight: '650',
    color: colors.ink.secondary,
    marginBottom: 8,
  },

  flexRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  flexPill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.control.chipBg,
    borderWidth: 1,
    borderColor: colors.control.chipBorder,
  },
  flexPillActive: {
    backgroundColor: 'rgba(255,215,0,0.12)',
    borderColor: 'rgba(255,215,0,0.40)',
  },
  flexPillTxt: { fontSize: 13, fontFamily: fonts.bodyMedium, color: colors.ink.secondary },
  flexPillTxtActive: { color: colors.brandGold },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
    backgroundColor: colors.control.fieldBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.control.fieldBorder,
  },
  dateRowTxt: { fontSize: 14, color: colors.ink.primary, fontFamily: fonts.bodyMedium },

  durationPresetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  durationPresetChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.control.chipBg,
    borderWidth: 1,
    borderColor: colors.control.chipBorder,
  },
  durationPresetChipActive: {
    backgroundColor: 'rgba(255,215,0,0.14)',
    borderColor: 'rgba(255,215,0,0.45)',
  },
  durationPresetChipText: {
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
    color: colors.ink.secondary,
  },
  durationPresetChipTextActive: {
    color: colors.brandGold,
  },
  durationCustomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    marginBottom: 8,
  },
  durationCustomField: {
    width: 72,
  },
  durationCustomLabel: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: fonts.bodyMedium,
    color: colors.ink.tertiary,
    marginBottom: 6,
  },
  durationCustomInput: {
    backgroundColor: colors.control.fieldBg,
    borderWidth: 1,
    borderColor: colors.control.fieldBorder,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    fontSize: 15,
    fontFamily: fonts.bodyMedium,
    color: colors.ink.primary,
    textAlign: 'center',
  },
  durationCustomSummary: {
    fontSize: 13,
    color: colors.ink.tertiary,
    marginLeft: 4,
    paddingBottom: 10,
    flex: 1,
  },
  durationSummary: {
    fontSize: 12,
    color: colors.ink.tertiary,
    marginTop: 2,
    marginBottom: 4,
  },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    backgroundColor: colors.control.chipBg,
    borderColor: colors.control.chipBorder,
  },
  chipTxt: { fontSize: 12, fontFamily: fonts.bodyMedium, color: colors.ink.secondary },

  /* ── Repeat ──────────────────────────────────────────── */
  repeatSection: {
    marginBottom: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.control.chipBorder,
    backgroundColor: colors.control.chipBg,
    overflow: 'hidden',
  },
  repeatToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
    gap: 10,
  },
  repeatToggleLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
    color: colors.ink.primary,
  },
  repeatToggleLabelActive: {
    color: colors.brandGold,
  },
  repeatToggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(31,26,20,0.10)',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  repeatToggleOn: {
    backgroundColor: 'rgba(255,215,0,0.30)',
  },
  repeatToggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.78)',
    alignSelf: 'flex-start',
  },
  repeatToggleThumbOn: {
    backgroundColor: colors.brandGold,
    alignSelf: 'flex-end',
  },
  repeatExpanded: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider.subtle,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 12,
  },
  repeatPresetRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  repeatPresetChip: {
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.control.chipBg,
    borderWidth: 1,
    borderColor: colors.control.chipBorder,
  },
  repeatPresetChipActive: {
    backgroundColor: 'rgba(255,215,0,0.12)',
    borderColor: 'rgba(255,215,0,0.40)',
  },
  repeatPresetChipText: {
    fontSize: 12,
    fontFamily: fonts.bodyMedium,
    color: colors.ink.secondary,
  },
  repeatPresetChipTextActive: {
    color: colors.brandGold,
  },
  repeatDayRow: {
    flexDirection: 'row',
    gap: 6,
  },
  repeatDayChip: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.control.chipBorder,
    backgroundColor: colors.control.chipBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  repeatDayChipActive: {
    backgroundColor: colors.brandGold,
    borderColor: 'rgba(255,215,0,0.55)',
  },
  repeatDayChipText: {
    fontSize: 12,
    fontFamily: fonts.bodyMedium,
    color: colors.ink.secondary,
  },
  repeatDayChipTextActive: {
    color: colors.ink.primary,
  },
  repeatEndRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider.subtle,
    paddingTop: 10,
  },
  repeatEndToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  repeatEndLabel: {
    fontSize: 13,
    color: colors.ink.tertiary,
  },
  repeatEndValue: {
    flex: 1,
    fontSize: 13,
    fontFamily: fonts.bodyRegular,
    color: colors.ink.secondary,
    textAlign: 'right',
    marginRight: 4,
  },
  repeatEndValueActive: {
    color: colors.brandGold,
  },

  procRow: { borderRadius: 12, borderWidth: 1, overflow: 'hidden', marginBottom: 24 },
  procInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  procText: { flex: 1, gap: 2 },
  procTitle: { fontSize: 14, fontWeight: '650', color: colors.ink.primary },
  procTitleActive: { color: colors.orange },
  procSub: { fontSize: 11, color: colors.ink.tertiary, lineHeight: 15 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.control.fieldBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: colors.orange, borderColor: colors.orange },

  scheduleBtn: {
    marginTop: 12,
  },
  scheduleBtnDisabled: { opacity: 1 },

  /* Break-it-down flow */
  breakdownStep: { paddingTop: 8 },
  breakdownHeading: {
    fontSize: 18,
    fontFamily: fonts.bodyMedium,
    color: colors.ink.primary,
    marginBottom: 4,
  },
  breakdownSub: {
    fontSize: 14,
    color: colors.ink.secondary,
    marginBottom: 20,
    lineHeight: 20,
  },
  subtaskList: {
    backgroundColor: colors.surface.card,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.surface.cardBorder,
  },
  subtaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider.subtle,
  },
  subtaskRowExcluded: {
    opacity: 0.5,
  },
  subtaskCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.control.fieldBorder,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  subtaskCheckboxActive: {
    backgroundColor: colors.brandGold,
    borderColor: 'rgba(255,215,0,0.55)',
  },
  subtaskBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brandGold,
    opacity: 0.9,
    flexShrink: 0,
  },
  subtaskTitle: {
    flex: 1,
    fontSize: 15,
    fontFamily: fonts.bodyRegular,
    color: colors.ink.primary,
    lineHeight: 20,
  },
  subtaskTitleInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: fonts.bodyRegular,
    color: colors.ink.primary,
    lineHeight: 20,
    paddingVertical: 4,
    paddingHorizontal: 0,
    minHeight: 24,
  },
  subtaskTitleExcluded: {
    color: colors.ink.tertiary,
    textDecorationLine: 'line-through',
  },
  subtaskRemoveBtn: {
    padding: 6,
    margin: -6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addStepBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    marginBottom: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.40)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(255,215,0,0.08)',
  },
  addStepBtnText: {
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
    color: colors.brandGold,
  },
  subtaskDurWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  subtaskDurInput: {
    width: 44,
    height: 32,
    backgroundColor: colors.control.fieldBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.control.fieldBorder,
    fontSize: 13,
    fontFamily: fonts.bodyMedium,
    color: colors.ink.primary,
    textAlign: 'center',
    padding: 0,
  },
  subtaskDurLabel: {
    fontSize: 11,
    fontFamily: fonts.bodyRegular,
    color: colors.ink.tertiary,
  },
  subtaskRowLast: { borderBottomWidth: 0 },
  doesThisLook: {
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
    color: colors.ink.secondary,
    marginBottom: 12,
  },
  breakdownActions: {
    flexDirection: 'row',
    gap: 12,
  },
  looksGoodBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.primaryYellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  looksGoodBtnDisabled: {
    opacity: 0.5,
  },
  looksGoodBtnText: {
    fontSize: 15,
    fontFamily: fonts.bodyMedium,
    color: colors.bodyText,
  },
  editBreakdownBtn: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.control.chipBg,
    borderWidth: 1,
    borderColor: colors.control.chipBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBreakdownBtnText: {
    fontSize: 15,
    fontFamily: fonts.bodyMedium,
    color: colors.ink.primary,
  },

  chooseFirstStep: { paddingTop: 8 },
  chooseFirstList: { gap: 0 },
  chooseFirstRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 6,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider.subtle,
  },
  chooseFirstRowLast: { borderBottomWidth: 0 },
  chooseFirstDur: {
    fontSize: 12,
    fontFamily: fonts.bodyMedium,
    color: colors.ink.tertiary,
    flexShrink: 0,
    minWidth: 36,
  },
  scheduleOneBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: colors.brandGold,
    flexShrink: 0,
  },
  scheduleOneBtnText: {
    fontSize: 13,
    fontFamily: fonts.bodyMedium,
    color: colors.bodyText,
  },
});
