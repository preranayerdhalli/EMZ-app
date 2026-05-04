import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { palette, colors, fonts, borderRadius, cardShadow, spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { usePostHog } from 'posthog-react-native';
import { db, supabase } from '@/services/supabase';
import { connectGoogleCalendar, syncAppleCalendar } from '@/services/calendar';
import { syncHealthData } from '@/services/health';

const TOTAL_STEPS = 3;

const CURRENT_YEAR = new Date().getFullYear();

// ─── Types ────────────────────────────────────────────────────────────────────

type WearableId = 'apple-health' | 'health-connect';
type CalendarId = 'google-calendar' | 'apple-calendar';
type PillStatus = 'idle' | 'connecting' | 'connected';
type Gender = 'male' | 'female' | 'other' | null;

// ─── Selection card ───────────────────────────────────────────────────────────

type SelectCardProps = {
  icon: React.ReactNode;
  label: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
};

function SelectCard({ icon, label, subtitle, selected, onPress }: SelectCardProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, stiffness: 300, damping: 22 }),
    ]).start();
    onPress();
  };

  return (
    <Pressable onPress={handlePress} style={styles.cardOuter}>
      <Animated.View
        style={[
          styles.selectCard,
          selected && styles.selectCardActive,
          { transform: [{ scale }] },
        ]}
      >
        {selected && (
          <LinearGradient
            colors={[`${palette.accentYellow}22`, `${palette.accentOrangeLight}18`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        <View style={styles.selectCardIcon}>{icon}</View>
        <Text style={styles.selectCardLabel}>{label}</Text>
        {subtitle && <Text style={styles.selectCardSubtitle}>{subtitle}</Text>}
        {selected && (
          <View style={styles.checkBadge}>
            <Ionicons name="checkmark" size={11} color={palette.textPrimary} />
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

// ─── Birthday picker ──────────────────────────────────────────────────────────

function BirthdayPicker({ date, onChange }: { date: Date; onChange: (d: Date) => void }) {
  const [dd, setDd] = useState(date.getDate().toString().padStart(2, '0'));
  const [mm, setMm] = useState((date.getMonth() + 1).toString().padStart(2, '0'));
  const [yyyy, setYyyy] = useState(date.getFullYear().toString());
  const [focused, setFocused] = useState<'dd' | 'mm' | 'yyyy' | null>(null);

  const monthRef = useRef<TextInput>(null);
  const yearRef = useRef<TextInput>(null);

  const commit = (newDd: string, newMm: string, newYyyy: string) => {
    const d = parseInt(newDd, 10);
    const m = parseInt(newMm, 10);
    const y = parseInt(newYyyy, 10);
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1920 && y <= CURRENT_YEAR - 5) {
      const built = new Date(y, m - 1, d);
      if (!isNaN(built.getTime())) onChange(built);
    }
  };

  const handleDay = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 2);
    setDd(clean);
    if (clean.length === 2) { monthRef.current?.focus(); commit(clean, mm, yyyy); }
  };

  const handleMonth = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 2);
    setMm(clean);
    if (clean.length === 2) { yearRef.current?.focus(); commit(dd, clean, yyyy); }
  };

  const handleYear = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 4);
    setYyyy(clean);
    if (clean.length === 4) commit(dd, mm, clean);
  };

  return (
    <View style={styles.bdRow}>
      {/* Day */}
      <View style={styles.bdSegment}>
        <TextInput
          style={[styles.bdInput, focused === 'dd' && styles.bdInputFocused]}
          value={dd}
          onChangeText={handleDay}
          onFocus={() => setFocused('dd')}
          onBlur={() => setFocused(null)}
          keyboardType="number-pad"
          maxLength={2}
          placeholder="DD"
          placeholderTextColor={colors.ink.placeholder}
          returnKeyType="next"
          selectTextOnFocus
        />
        <Text style={styles.bdSegLabel}>Day</Text>
      </View>

      <Text style={styles.bdSep}>/</Text>

      {/* Month */}
      <View style={styles.bdSegment}>
        <TextInput
          ref={monthRef}
          style={[styles.bdInput, focused === 'mm' && styles.bdInputFocused]}
          value={mm}
          onChangeText={handleMonth}
          onFocus={() => setFocused('mm')}
          onBlur={() => setFocused(null)}
          keyboardType="number-pad"
          maxLength={2}
          placeholder="MM"
          placeholderTextColor={colors.ink.placeholder}
          returnKeyType="next"
          selectTextOnFocus
        />
        <Text style={styles.bdSegLabel}>Month</Text>
      </View>

      <Text style={styles.bdSep}>/</Text>

      {/* Year */}
      <View style={[styles.bdSegment, { flex: 1.6 }]}>
        <TextInput
          ref={yearRef}
          style={[styles.bdInput, focused === 'yyyy' && styles.bdInputFocused]}
          value={yyyy}
          onChangeText={handleYear}
          onFocus={() => setFocused('yyyy')}
          onBlur={() => setFocused(null)}
          keyboardType="number-pad"
          maxLength={4}
          placeholder="YYYY"
          placeholderTextColor={colors.ink.placeholder}
          returnKeyType="done"
          selectTextOnFocus
        />
        <Text style={styles.bdSegLabel}>Year</Text>
      </View>
    </View>
  );
}

// ─── Gender dropdown ──────────────────────────────────────────────────────────

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'male',   label: 'Male'   },
  { value: 'female', label: 'Female' },
  { value: 'other',  label: 'Other'  },
];

function GenderDropdown({ value, onChange }: { value: Gender; onChange: (g: Gender) => void }) {
  const [open, setOpen] = useState(false);

  const selectedLabel = GENDER_OPTIONS.find(o => o.value === value)?.label ?? 'Select…';

  return (
    <View style={styles.dropdownWrapper}>
      <Pressable
        onPress={() => setOpen(o => !o)}
        style={[styles.dropdownTrigger, open && styles.dropdownTriggerOpen]}
      >
        <Text style={[styles.dropdownValue, !value && styles.dropdownPlaceholder]}>
          {selectedLabel}
        </Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.ink.tertiary}
        />
      </Pressable>

      {open && (
        <View style={styles.dropdownMenu}>
          {GENDER_OPTIONS.map((opt, i) => (
            <Pressable
              key={opt.value}
              onPress={() => { onChange(opt.value); setOpen(false); }}
              style={[
                styles.dropdownItem,
                i < GENDER_OPTIONS.length - 1 && styles.dropdownItemBorder,
                opt.value === value && styles.dropdownItemActive,
              ]}
            >
              <Text style={[styles.dropdownItemText, opt.value === value && styles.dropdownItemTextActive]}>
                {opt.label}
              </Text>
              {opt.value === value && (
                <Ionicons name="checkmark" size={14} color={palette.accentOrange} />
              )}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Profile step (step 0) ────────────────────────────────────────────────────

type ProfileStepProps = {
  name: string;
  setName: (v: string) => void;
  birthday: Date;
  setBirthday: (d: Date) => void;
  gender: Gender;
  setGender: (g: Gender) => void;
  nameError: boolean;
};

function ProfileStep({ name, setName, birthday, setBirthday, gender, setGender, nameError }: ProfileStepProps) {
  const [nameFocused, setNameFocused] = useState(false);

  // Staggered entrance for 5 elements: badge, title+sub, name, birthday, gender+note
  const anims = useRef(
    Array.from({ length: 4 }, () => ({
      op: new Animated.Value(0),
      ty: new Animated.Value(22),
    }))
  ).current;

  useEffect(() => {
    Animated.stagger(
      75,
      anims.map(a =>
        Animated.parallel([
          Animated.timing(a.op, { toValue: 1, duration: 520, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(a.ty, { toValue: 0, duration: 520, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        ])
      )
    ).start();
  }, []);

  const wrap = (i: number, children: React.ReactNode) => (
    <Animated.View style={{ opacity: anims[i].op, transform: [{ translateY: anims[i].ty }] }}>
      {children}
    </Animated.View>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.p0Scroll}>

        {/* Heading */}
        {wrap(0, (
          <View style={styles.p0Heading}>
            <Text style={styles.p0Title}>First, a few things{'\n'}about you.</Text>
            <Text style={styles.p0Subtitle}>So EMZ knows what normal looks like for your body.</Text>
          </View>
        ))}

        {/* Name */}
        {wrap(1, (
          <View style={styles.p0Field}>
            <Text style={styles.p0FieldLabel}>What do we call you?</Text>
            <TextInput
              style={[styles.p0Input, nameFocused && styles.p0InputFocused, nameError && styles.p0InputError]}
              value={name}
              onChangeText={setName}
              onFocus={() => setNameFocused(true)}
              onBlur={() => setNameFocused(false)}
              placeholder="Your first name"
              placeholderTextColor={colors.ink.placeholder}
              autoCapitalize="words"
              returnKeyType="done"
              maxLength={40}
            />
            {nameError && (
              <Text style={styles.p0FieldError}>Please enter your name to continue.</Text>
            )}
          </View>
        ))}

        {/* Birthday */}
        {wrap(2, (
          <View style={styles.p0Field}>
            <Text style={styles.p0FieldLabel}>When's your birthday?</Text>
            <BirthdayPicker date={birthday} onChange={setBirthday} />
          </View>
        ))}

        {/* Gender */}
        {wrap(3, (
          <View style={[styles.p0Field, { zIndex: 10 }]}>
            <Text style={styles.p0FieldLabel}>Biological sex</Text>
            <GenderDropdown value={gender} onChange={setGender} />
            <Text style={styles.p0Privacy}>Used only to personalise health insights. Never shared.</Text>
          </View>
        ))}

        <View style={{ height: 120 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Connect step (step 1) ────────────────────────────────────────────────────

type ConnectStepProps = {
  wearableStatuses: Record<WearableId, PillStatus>;
  calendarStatuses: Record<CalendarId, PillStatus>;
  onConnectWearable: (id: WearableId) => void;
  onConnectCalendar: (id: CalendarId) => void;
  onSkip: () => void;
};

function ConnectTile({
  icon,
  title,
  supporting,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  supporting: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.connectTile}>
      <View style={styles.connectTileHeader}>
        <View style={styles.connectTileIcon}>{icon}</View>
        <View style={{ flex: 1 }}>
          <Text style={styles.connectTileTitle}>{title}</Text>
          <Text style={styles.connectTileSupport}>{supporting}</Text>
        </View>
      </View>
      <View style={styles.connectTileOptions}>{children}</View>
    </View>
  );
}

function ConnectPill({
  icon,
  label,
  status,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  status: PillStatus;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    if (status !== 'idle') return;
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.95, duration: 70, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, stiffness: 340, damping: 20 }),
    ]).start();
    onPress();
  };

  const connected = status === 'connected';
  const connecting = status === 'connecting';

  return (
    <Pressable onPress={handlePress} disabled={connecting}>
      <Animated.View style={[
        styles.connectPill,
        connected && styles.connectPillConnected,
        connecting && styles.connectPillConnecting,
        { transform: [{ scale }] },
      ]}>
        {connected && (
          <LinearGradient
            colors={['rgba(76,175,80,0.14)', 'rgba(76,175,80,0.07)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        <View style={styles.connectPillIconWrap}>{icon}</View>
        <Text style={[
          styles.connectPillLabel,
          connected && styles.connectPillLabelConnected,
          connecting && styles.connectPillLabelConnecting,
        ]}>
          {label}
        </Text>
        {connecting && (
          <ActivityIndicator size="small" color={palette.accentOrange} style={{ marginLeft: 4 }} />
        )}
        {connected && (
          <Ionicons name="checkmark-circle" size={14} color="#4CAF50" style={{ marginLeft: 4 }} />
        )}
        {!connecting && !connected && (
          <View style={styles.connectChip}>
            <Text style={styles.connectChipText}>Connect</Text>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

function ConnectStep({ wearableStatuses, calendarStatuses, onConnectWearable, onConnectCalendar, onSkip }: ConnectStepProps) {
  const anims = useRef(
    Array.from({ length: 3 }, () => ({
      op: new Animated.Value(0),
      ty: new Animated.Value(20),
    }))
  ).current;

  useEffect(() => {
    Animated.stagger(
      80,
      anims.map(a =>
        Animated.parallel([
          Animated.timing(a.op, { toValue: 1, duration: 500, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(a.ty, { toValue: 0, duration: 500, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        ])
      )
    ).start();
  }, []);

  const wrap = (i: number, children: React.ReactNode) => (
    <Animated.View style={{ opacity: anims[i].op, transform: [{ translateY: anims[i].ty }] }}>
      {children}
    </Animated.View>
  );

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.connectScroll}>

      {wrap(0, (
        <View style={styles.connectHeading}>
          <Text style={styles.p0Title}>Now let's{'\n'}plug you in.</Text>
          <Text style={styles.p0Subtitle}>
            This is where EMZ gets smart. Your wearable and calendar are the two things it needs to actually help you.
          </Text>
        </View>
      ))}

      {wrap(1, (
        <ConnectTile
          icon={<Ionicons name="fitness-outline" size={20} color={palette.accentOrange} />}
          title="Connect your wearable"
          supporting="Your energy, sleep and recovery. The stuff your body's already tracking."
        >
          {Platform.OS === 'ios' && (
            <ConnectPill
              icon={<Ionicons name="heart" size={15} color="#FF3B5C" />}
              label="Apple Health"
              status={wearableStatuses['apple-health']}
              onPress={() => onConnectWearable('apple-health')}
            />
          )}
          {Platform.OS === 'android' && (
            <ConnectPill
              icon={<Ionicons name="pulse" size={15} color="#1DA462" />}
              label="Health Connect"
              status={wearableStatuses['health-connect']}
              onPress={() => onConnectWearable('health-connect')}
            />
          )}
        </ConnectTile>
      ))}

      {wrap(2, (
        <ConnectTile
          icon={<Ionicons name="calendar-outline" size={20} color={palette.accentOrange} />}
          title="Connect your calendar"
          supporting="Your day, mapped against how you actually feel."
        >
          <ConnectPill
            icon={<Ionicons name="logo-google" size={15} color="#4285F4" />}
            label="Google Calendar"
            status={calendarStatuses['google-calendar']}
            onPress={() => onConnectCalendar('google-calendar')}
          />
          {Platform.OS === 'ios' && (
            <ConnectPill
              icon={<Ionicons name="logo-apple" size={15} color={colors.ink.primary} />}
              label="Apple Calendar"
              status={calendarStatuses['apple-calendar']}
              onPress={() => onConnectCalendar('apple-calendar')}
            />
          )}
        </ConnectTile>
      ))}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

// ─── Schedule step (step 2) ──────────────────────────────────────────────────

type ScheduleStepProps = {
  workStart: Date;
  setWorkStart: (d: Date) => void;
  workEnd: Date;
  setWorkEnd: (d: Date) => void;
  sleepStart: Date;
  setSleepStart: (d: Date) => void;
  sleepEnd: Date;
  setSleepEnd: (d: Date) => void;
};

function ScheduleStep({
  workStart, setWorkStart, workEnd, setWorkEnd,
  sleepStart, setSleepStart, sleepEnd, setSleepEnd,
}: ScheduleStepProps) {
  const anims = useRef(
    Array.from({ length: 3 }, () => ({
      op: new Animated.Value(0),
      ty: new Animated.Value(20),
    }))
  ).current;

  useEffect(() => {
    Animated.stagger(
      80,
      anims.map(a =>
        Animated.parallel([
          Animated.timing(a.op, { toValue: 1, duration: 500, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(a.ty, { toValue: 0, duration: 500, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        ])
      )
    ).start();
  }, []);

  const wrap = (i: number, children: React.ReactNode) => (
    <Animated.View style={{ opacity: anims[i].op, transform: [{ translateY: anims[i].ty }] }}>
      {children}
    </Animated.View>
  );

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scheduleScroll}>

      {wrap(0, (
        <View style={styles.connectHeading}>
          <Text style={styles.p0Title}>How does your{'\n'}day run?</Text>
          <Text style={styles.p0Subtitle}>So your energy windows line up with your life.</Text>
        </View>
      ))}

      {wrap(1, (
        <View style={styles.scheduleTile}>
          <View style={styles.scheduleTileHeader}>
            <View style={styles.scheduleTileIconWrap}>
              <Ionicons name="briefcase-outline" size={16} color={palette.accentOrange} />
            </View>
            <Text style={styles.scheduleTileTitle}>Work</Text>
          </View>
          <TimeRow label="Start" time={workStart} onChange={setWorkStart} />
          <TimeRow label="End" time={workEnd} onChange={setWorkEnd} divider={false} />
        </View>
      ))}

      {wrap(2, (
        <View style={styles.scheduleTile}>
          <View style={styles.scheduleTileHeader}>
            <View style={styles.scheduleTileIconWrap}>
              <Ionicons name="moon-outline" size={16} color={palette.accentOrange} />
            </View>
            <Text style={styles.scheduleTileTitle}>Sleep</Text>
          </View>
          <TimeRow label="Bedtime" time={sleepStart} onChange={setSleepStart} />
          <TimeRow label="Wake up" time={sleepEnd} onChange={setSleepEnd} divider={false} />
        </View>
      ))}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

// ─── Time row (stepper + tap-to-type) ────────────────────────────────────────

function TimeRow({ label, time, onChange, divider = true }: { label: string; time: Date; onChange: (d: Date) => void; divider?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<TextInput>(null);

  const nudge = (minutes: number) => {
    const d = new Date(time);
    d.setMinutes(d.getMinutes() + minutes);
    onChange(d);
  };

  const toggleAMPM = () => {
    const d = new Date(time);
    d.setHours((d.getHours() + 12) % 24);
    onChange(d);
  };

  const hours = time.getHours();
  const mins = time.getMinutes();
  const isPM = hours >= 12;
  const displayHour = (hours % 12 || 12).toString().padStart(2, '0');
  const displayMin = mins.toString().padStart(2, '0');

  const startEditing = () => {
    setDraft(`${displayHour}:${displayMin}`);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const commitDraft = (value: string) => {
    const clean = value.replace(/[^0-9:]/g, '');
    const match = clean.match(/^(\d{1,2}):?(\d{2})$/);
    if (match) {
      let h = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      if (h >= 1 && h <= 12 && m >= 0 && m <= 59) {
        // Keep current AM/PM
        h = isPM ? (h === 12 ? 12 : h + 12) : (h === 12 ? 0 : h);
        const d = new Date(time);
        d.setHours(h, m, 0, 0);
        onChange(d);
      }
    }
    setEditing(false);
  };

  const handleChangeText = (val: string) => {
    // Auto-insert colon after 2 digits
    let v = val.replace(/[^0-9:]/g, '');
    if (v.length === 2 && !v.includes(':') && draft.length < 2) {
      v = v + ':';
    }
    setDraft(v);
  };

  return (
    <View style={[styles.timeRowWrap, divider && styles.timeRowDivider]}>
      <Text style={styles.timeRowLabel}>{label}</Text>
      <View style={styles.timeRowRight}>
        <Pressable onPress={() => nudge(-30)} hitSlop={12} style={styles.timeStepBtn}>
          <Ionicons name="remove" size={16} color={colors.ink.tertiary} />
        </Pressable>

        <Pressable onPress={startEditing} style={styles.timeDisplay}>
          {editing ? (
            <TextInput
              ref={inputRef}
              style={styles.timeDisplayInput}
              value={draft}
              onChangeText={handleChangeText}
              onBlur={() => commitDraft(draft)}
              onSubmitEditing={() => commitDraft(draft)}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
              selectTextOnFocus
              returnKeyType="done"
            />
          ) : (
            <Text style={styles.timeDisplayDigits}>{displayHour}:{displayMin}</Text>
          )}
          <Pressable onPress={toggleAMPM} hitSlop={8}>
            <Text style={styles.timeDisplayAmpm}>{isPM ? 'PM' : 'AM'}</Text>
          </Pressable>
        </Pressable>

        <Pressable onPress={() => nudge(30)} hitSlop={12} style={styles.timeStepBtn}>
          <Ionicons name="add" size={16} color={colors.ink.tertiary} />
        </Pressable>
      </View>
    </View>
  );
}

// ─── Progress dots ────────────────────────────────────────────────────────────

function ProgressDots({ step }: { step: number }) {
  return (
    <View style={styles.dots}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i === step && styles.dotActive,
            i < step && styles.dotDone,
          ]}
        />
      ))}
    </View>
  );
}

// ─── Continue button ──────────────────────────────────────────────────────────

function ContinueButton({ label = 'Continue', onPress }: { label?: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.continueBtn, pressed && styles.continueBtnPressed]}
    >
      <LinearGradient
        colors={[palette.accentYellow, palette.accentOrangeLight]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Text style={styles.continueBtnText}>{label}</Text>
    </Pressable>
  );
}

// ─── Main onboarding screen ───────────────────────────────────────────────────

export default function OnboardingScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const posthog = usePostHog();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState(false);

  // Step 0 — profile
  const [name, setName] = useState('');
  const [birthday, setBirthday] = useState(() => {
    const d = new Date(1995, 0, 1);
    return d;
  });
  const [gender, setGender] = useState<Gender>(null);

  // Step 1 — wearable + calendar connection statuses
  const [wearableStatuses, setWearableStatuses] = useState<Record<WearableId, PillStatus>>({
    'apple-health': 'idle',
    'health-connect': 'idle',
  });
  const [calendarStatuses, setCalendarStatuses] = useState<Record<CalendarId, PillStatus>>({
    'google-calendar': 'idle',
    'apple-calendar': 'idle',
  });

  const handleConnectWearable = async (id: WearableId) => {
    setWearableStatuses(prev => ({ ...prev, [id]: 'connecting' }));
    try {
      await syncHealthData();
      setWearableStatuses(prev => ({ ...prev, [id]: 'connected' }));
    } catch {
      setWearableStatuses(prev => ({ ...prev, [id]: 'idle' }));
    }
  };

  const handleConnectCalendar = async (id: CalendarId) => {
    setCalendarStatuses(prev => ({ ...prev, [id]: 'connecting' }));
    try {
      if (id === 'google-calendar') {
        const ok = await connectGoogleCalendar();
        setCalendarStatuses(prev => ({ ...prev, [id]: ok ? 'connected' : 'idle' }));
      } else if (id === 'apple-calendar') {
        await syncAppleCalendar();
        setCalendarStatuses(prev => ({ ...prev, [id]: 'connected' }));
      }
    } catch {
      setCalendarStatuses(prev => ({ ...prev, [id]: 'idle' }));
    }
  };

  // Step 2 — schedule
  const [startTime, setStartTime] = useState(() => {
    const d = new Date(); d.setHours(9, 0, 0, 0); return d;
  });
  const [endTime, setEndTime] = useState(() => {
    const d = new Date(); d.setHours(18, 0, 0, 0); return d;
  });
  const [sleepStart, setSleepStart] = useState(() => {
    const d = new Date(); d.setHours(23, 0, 0, 0); return d;
  });
  const [sleepEnd, setSleepEnd] = useState(() => {
    const d = new Date(); d.setHours(7, 0, 0, 0); return d;
  });

  // Animations
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const contentTranslateX = useRef(new Animated.Value(0)).current;
  const pageOpacity = useRef(new Animated.Value(0)).current;
  const pageTranslateY = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(pageOpacity, { toValue: 1, duration: 500, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(pageTranslateY, { toValue: 0, duration: 500, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start();
  }, []);

  const transitionToStep = (next: number) => {
    Animated.parallel([
      Animated.timing(contentOpacity, { toValue: 0, duration: 180, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      Animated.timing(contentTranslateX, { toValue: -30, duration: 180, easing: Easing.in(Easing.ease), useNativeDriver: true }),
    ]).start(() => {
      setStep(next);
      contentTranslateX.setValue(30);
      Animated.parallel([
        Animated.timing(contentOpacity, { toValue: 1, duration: 260, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(contentTranslateX, { toValue: 0, duration: 260, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      ]).start();
    });
  };

  const saveAndNavigate = async (includeSelections: boolean) => {
    if (saving) return;
    setSaving(true);

    // Derive what's actually been connected (regardless of skip/finish)
    const connectedWearable: WearableId | null =
      wearableStatuses['apple-health'] === 'connected' ? 'apple-health' :
      wearableStatuses['health-connect'] === 'connected' ? 'health-connect' : null;
    const connectedCalendar: CalendarId | null =
      calendarStatuses['google-calendar'] === 'connected' ? 'google-calendar' :
      calendarStatuses['apple-calendar'] === 'connected' ? 'apple-calendar' : null;

    try {
      if (session) {
        // Save profile to users table
        if (name.trim() || gender || includeSelections) {
          const userPatch: Record<string, unknown> = {};
          if (name.trim()) userPatch.full_name = name.trim();
          if (gender) userPatch.gender = gender;
          if (birthday) userPatch.birthday = birthday.toISOString().split('T')[0]; // YYYY-MM-DD
          userPatch.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
          await db.users().update(userPatch).eq('id', session.user.id);
          // Also update auth user metadata so home/settings screens see the name immediately
          if (name.trim()) {
            await supabase.auth.updateUser({ data: { full_name: name.trim() } });
          }
        }

        // Save settings — use upsert so new users without an existing row don't get stuck
        await db.userSettings().upsert(
          {
            user_id: session.user.id,
            onboarding_complete: true,
            work_start_hour: includeSelections ? startTime.getHours() : 9,
            work_end_hour: includeSelections ? endTime.getHours() : 18,
            sleep_start_hour: includeSelections ? sleepStart.getHours() : 23,
            sleep_end_hour: includeSelections ? sleepEnd.getHours() : 7,
            wearable_ios: connectedWearable === 'apple-health' ? 'apple-health' : null,
            wearable_android: connectedWearable === 'health-connect' ? 'health-connect' : null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        );
        posthog?.capture('onboarding_completed', {
          has_name: !!name.trim(),
          wearable: connectedWearable ?? 'none',
          calendar: connectedCalendar ?? 'none',
          included_selections: includeSelections,
        });
        if (session?.user.id) {
          posthog?.identify(session.user.id, { email: session.user.email ?? '' });
        }
      }
    } catch {
      // Non-fatal: proceed so users aren't locked out
    } finally {
      setSaving(false);
    }
    router.replace('/(main-screens)');
  };

  const finish = () => saveAndNavigate(true);
  const skip = () => saveAndNavigate(false);

  const handleContinue = async () => {
    // Step 0: profile — name is required
    if (step === 0) {
      if (!name.trim()) {
        setNameError(true);
        return;
      }
      setNameError(false);
    }

    // Step 1: connections are triggered inline when pills are tapped — nothing to do here

    if (step < TOTAL_STEPS - 1) {
      transitionToStep(step + 1);
    } else {
      finish();
    }
  };

  // ── Step content ─────────────────────────────────────────────────────────

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <ProfileStep
            name={name}
            setName={(v) => { setName(v); if (v.trim()) setNameError(false); }}
            birthday={birthday}
            setBirthday={setBirthday}
            gender={gender}
            setGender={setGender}
            nameError={nameError}
          />
        );

      case 1:
        return (
          <ConnectStep
            wearableStatuses={wearableStatuses}
            calendarStatuses={calendarStatuses}
            onConnectWearable={handleConnectWearable}
            onConnectCalendar={handleConnectCalendar}
            onSkip={skip}
          />
        );

      case 2:
        return (
          <ScheduleStep
            workStart={startTime}
            setWorkStart={setStartTime}
            workEnd={endTime}
            setWorkEnd={setEndTime}
            sleepStart={sleepStart}
            setSleepStart={setSleepStart}
            sleepEnd={sleepEnd}
            setSleepEnd={setSleepEnd}
          />
        );
    }
  };

  const isLastStep = step === TOTAL_STEPS - 1;

  return (
    <LinearGradient
      colors={[palette.background, palette.backgroundSecondary]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={styles.root}
    >
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <Animated.View style={[styles.inner, { opacity: pageOpacity, transform: [{ translateY: pageTranslateY }] }]}>

          {/* Top row: dots + skip (hidden on profile step) */}
          <View style={styles.topBar}>
            <ProgressDots step={step} />
            {step > 0 && (
              <Pressable onPress={skip} hitSlop={12} accessibilityRole="button" accessibilityLabel="Skip onboarding">
                <Text style={styles.skipText}>Skip</Text>
              </Pressable>
            )}
          </View>

          {/* Step content (animated) */}
          <Animated.View
            style={[
              styles.content,
              { opacity: contentOpacity, transform: [{ translateX: contentTranslateX }] },
            ]}
          >
            {renderStep()}
          </Animated.View>

          {/* Continue button */}
          <View style={styles.footer}>
            <ContinueButton
              label={isLastStep ? (saving ? 'Saving…' : 'Get started') : saving ? 'Connecting…' : 'Continue'}
              onPress={saving ? () => {} : () => { handleContinue(); }}
            />
          </View>

        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  inner: { flex: 1, paddingHorizontal: 16 },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  skipText: {
    fontSize: 14,
    fontFamily: fonts.bodyRegular,
    color: colors.ink.tertiary,
  },

  // Progress dots
  dots: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(46,46,46,0.14)',
  },
  dotActive: {
    width: 22,
    backgroundColor: palette.accentOrange,
  },
  dotDone: {
    backgroundColor: 'rgba(46,46,46,0.28)',
  },

  // Step content
  content: {
    flex: 1,
    paddingTop: spacing.sm,
  },
  // ── Profile step (step 0) ───────────────────────────────────────────────────
  p0Scroll: {
    paddingTop: 0,
  },
  p0BadgeRow: {
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  p0Badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.pill,
    backgroundColor: `${palette.accentYellow}28`,
    borderWidth: 1,
    borderColor: `${palette.accentOrangeLight}50`,
  },
  p0BadgeText: {
    fontSize: 12,
    fontFamily: fonts.bodyMedium,
    color: palette.accentOrange,
    letterSpacing: 0.3,
  },
  p0Heading: {
    marginBottom: 22,
  },
  p0Title: {
    fontSize: 32,
    fontFamily: fonts.display,
    color: colors.ink.primary,
    lineHeight: 40,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  p0Subtitle: {
    fontSize: 14,
    fontFamily: fonts.bodyLight,
    color: colors.ink.secondary,
    lineHeight: 20,
  },
  p0Field: {
    marginBottom: 22,
  },
  p0FieldLabel: {
    fontSize: 12,
    fontFamily: fonts.bodyLight,
    color: colors.ink.tertiary,
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  p0Input: {
    fontSize: 22,
    fontFamily: fonts.display,
    color: colors.ink.primary,
    paddingBottom: 10,
    paddingHorizontal: 2,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.divider.strong,
  },
  p0InputFocused: {
    borderBottomColor: palette.accentOrange,
  },
  p0InputError: {
    borderBottomColor: '#FF453A',
  },
  p0FieldError: {
    marginTop: 7,
    fontSize: 12,
    fontFamily: fonts.bodyLight,
    color: '#FF453A',
  },
  p0Privacy: {
    marginTop: 12,
    fontSize: 11,
    fontFamily: fonts.bodyLight,
    color: colors.ink.tertiary,
    letterSpacing: 0.1,
  },

  // Birthday picker (underline style)
  bdRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  bdSegment: {
    flex: 1,
    alignItems: 'center',
  },
  bdInput: {
    fontSize: 22,
    fontFamily: fonts.display,
    color: colors.ink.primary,
    textAlign: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.divider.strong,
    width: '100%',
  },
  bdInputFocused: {
    borderBottomColor: palette.accentOrange,
  },
  bdSegLabel: {
    fontSize: 10,
    fontFamily: fonts.bodyLight,
    color: colors.ink.tertiary,
    letterSpacing: 0.3,
    marginTop: 6,
  },
  bdSep: {
    fontSize: 20,
    fontFamily: fonts.display,
    color: colors.divider.strong,
    marginBottom: 28,
    paddingHorizontal: 2,
  },

  // Gender dropdown
  dropdownWrapper: {
    zIndex: 10,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    paddingHorizontal: 2,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.divider.strong,
  },
  dropdownTriggerOpen: {
    borderBottomColor: palette.accentOrange,
  },
  dropdownValue: {
    fontSize: 22,
    fontFamily: fonts.display,
    color: colors.ink.primary,
  },
  dropdownPlaceholder: {
    color: colors.ink.placeholder,
  },
  dropdownMenu: {
    marginTop: 4,
    backgroundColor: colors.surface.cardStrong,
    borderRadius: borderRadius.card,
    borderWidth: 1,
    borderColor: colors.divider.strong,
    overflow: 'hidden',
    ...cardShadow,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  dropdownItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider.subtle,
  },
  dropdownItemActive: {
    backgroundColor: `${palette.accentYellow}18`,
  },
  dropdownItemText: {
    fontSize: 16,
    fontFamily: fonts.bodyRegular,
    color: colors.ink.primary,
  },
  dropdownItemTextActive: {
    fontFamily: fonts.bodyMedium,
    color: palette.accentOrange,
  },

  // ── Connect step (step 1) ────────────────────────────────────────────────────
  connectScroll: {
    paddingTop: 0,
  },
  connectHeading: {
    marginBottom: 28,
  },
  connectTile: {
    backgroundColor: colors.surface.cardStrong,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.divider.strong,
    padding: 18,
    marginBottom: 14,
    ...cardShadow,
  },
  connectTileHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  connectTileIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: `${palette.accentYellow}22`,
    borderWidth: 1,
    borderColor: `${palette.accentOrangeLight}40`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectTileTitle: {
    fontSize: 15,
    fontFamily: fonts.bodyMedium,
    color: colors.ink.primary,
    marginBottom: 3,
  },
  connectTileSupport: {
    fontSize: 12,
    fontFamily: fonts.bodyLight,
    color: colors.ink.secondary,
    lineHeight: 17,
  },
  connectTileOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  connectPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: borderRadius.pill,
    borderWidth: 1.5,
    borderColor: colors.divider.strong,
    backgroundColor: 'rgba(255,255,255,0.60)',
    overflow: 'hidden',
  },
  connectPillConnected: {
    borderColor: 'rgba(76,175,80,0.45)',
    backgroundColor: 'rgba(76,175,80,0.04)',
  },
  connectPillConnecting: {
    opacity: 0.75,
  },
  connectPillIconWrap: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectPillLabel: {
    fontSize: 13,
    fontFamily: fonts.bodyRegular,
    color: colors.ink.secondary,
  },
  connectPillLabelConnected: {
    fontFamily: fonts.bodyMedium,
    color: '#3d9142',
  },
  connectPillLabelConnecting: {
    color: colors.ink.tertiary,
  },
  connectChip: {
    backgroundColor: `${palette.accentOrange}18`,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 2,
  },
  connectChipText: {
    fontSize: 10,
    fontFamily: fonts.bodyMedium,
    color: palette.accentOrange,
    letterSpacing: 0.2,
  },

  // Selection cards
  cardRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cardOuter: {
    flex: 1,
  },
  selectCard: {
    borderRadius: borderRadius.card,
    borderWidth: 1.5,
    borderColor: colors.divider.strong,
    backgroundColor: palette.background,
    padding: 20,
    alignItems: 'center',
    gap: 12,
    overflow: 'hidden',
    ...cardShadow,
  },
  selectCardActive: {
    borderColor: palette.accentYellow,
    borderWidth: 2,
  },
  selectCardIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(46,46,46,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectCardLabel: {
    fontSize: 13,
    fontFamily: fonts.bodyMedium,
    color: colors.ink.primary,
    textAlign: 'center',
  },
  selectCardSubtitle: {
    fontSize: 11,
    fontFamily: fonts.bodyLight,
    color: colors.ink.tertiary,
    textAlign: 'center',
    lineHeight: 14,
  },
  checkBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: palette.accentYellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipNote: {
    marginTop: 14,
    fontSize: 12,
    fontFamily: fonts.bodyLight,
    color: colors.ink.tertiary,
    textAlign: 'center',
  },

  // Schedule step (step 2)
  scheduleScroll: {
    paddingTop: 0,
  },
  scheduleTile: {
    backgroundColor: colors.surface.cardStrong,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.divider.strong,
    padding: 18,
    marginBottom: 14,
    ...cardShadow,
  },
  scheduleTileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  scheduleTileIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: `${palette.accentYellow}22`,
    borderWidth: 1,
    borderColor: `${palette.accentOrangeLight}40`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleTileTitle: {
    fontSize: 15,
    fontFamily: fonts.bodyMedium,
    color: colors.ink.primary,
  },

  // Time rows
  timeRowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  timeRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider.subtle,
  },
  timeRowLabel: {
    fontSize: 14,
    fontFamily: fonts.bodyRegular,
    color: colors.ink.secondary,
  },
  timeRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeStepBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.surface.cardStrong,
    borderWidth: 1,
    borderColor: colors.divider.strong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    minWidth: 90,
    justifyContent: 'center',
  },
  timeDisplayDigits: {
    fontSize: 20,
    fontFamily: fonts.display,
    color: colors.ink.primary,
    letterSpacing: -0.3,
  },
  timeDisplayInput: {
    fontSize: 20,
    fontFamily: fonts.display,
    color: colors.ink.primary,
    letterSpacing: -0.3,
    minWidth: 54,
    textAlign: 'center',
    borderBottomWidth: 1.5,
    borderBottomColor: palette.accentOrange,
    paddingBottom: 1,
  },
  timeDisplayAmpm: {
    fontSize: 12,
    fontFamily: fonts.bodyMedium,
    color: palette.accentOrange,
    letterSpacing: 0.3,
  },

  // Footer
  footer: {
    paddingBottom: spacing.lg,
    paddingTop: spacing.md,
  },
  continueBtn: {
    height: 52,
    borderRadius: borderRadius.button,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,182,108,0.28)',
  },
  continueBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  continueBtnText: {
    fontSize: 16,
    fontFamily: fonts.bodyMedium,
    color: palette.textPrimary,
  },
});
