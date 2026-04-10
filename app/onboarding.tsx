import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { palette, colors, fonts, borderRadius, cardShadow, spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/services/supabase';

const TOTAL_STEPS = 3;

// ─── Types ────────────────────────────────────────────────────────────────────

type WearableId = 'apple-health' | 'google-fit' | null;
type CalendarId = 'google-calendar' | 'apple-calendar' | null;

// ─── Selection card ───────────────────────────────────────────────────────────

type SelectCardProps = {
  icon: React.ReactNode;
  label: string;
  selected: boolean;
  onPress: () => void;
};

function SelectCard({ icon, label, selected, onPress }: SelectCardProps) {
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
        {selected && (
          <View style={styles.checkBadge}>
            <Ionicons name="checkmark" size={11} color={palette.textPrimary} />
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

// ─── Time card (custom hour/minute/AM-PM picker) ──────────────────────────────

function TimeCard({ label, time, onChange }: { label: string; time: Date; onChange: (d: Date) => void }) {
  const nudge = (field: 'hour' | 'minute', delta: number) => {
    const d = new Date(time);
    if (field === 'hour') {
      d.setHours((d.getHours() + delta + 24) % 24);
    } else {
      // Snap minutes to nearest 15
      const snapped = Math.round(d.getMinutes() / 15) * 15;
      d.setMinutes(((snapped + delta * 15) + 60) % 60);
    }
    onChange(d);
  };

  const toggleAMPM = () => {
    const d = new Date(time);
    d.setHours((d.getHours() + 12) % 24);
    onChange(d);
  };

  const hours = time.getHours();
  const minutes = time.getMinutes();
  const isPM = hours >= 12;
  const displayHour = hours % 12 || 12;

  return (
    <View style={styles.timeCard}>
      <Text style={styles.timeCardLabel}>{label}</Text>

      <View style={styles.timeRow}>
        {/* Hour */}
        <View style={styles.timeCol}>
          <Pressable onPress={() => nudge('hour', 1)} hitSlop={10} style={styles.nudgeBtn}>
            <Ionicons name="chevron-up" size={18} color={palette.accentOrange} />
          </Pressable>
          <Text style={styles.timeDigit}>{displayHour.toString().padStart(2, '0')}</Text>
          <Pressable onPress={() => nudge('hour', -1)} hitSlop={10} style={styles.nudgeBtn}>
            <Ionicons name="chevron-down" size={18} color={palette.accentOrange} />
          </Pressable>
        </View>

        <Text style={styles.timeColon}>:</Text>

        {/* Minute */}
        <View style={styles.timeCol}>
          <Pressable onPress={() => nudge('minute', 1)} hitSlop={10} style={styles.nudgeBtn}>
            <Ionicons name="chevron-up" size={18} color={palette.accentOrange} />
          </Pressable>
          <Text style={styles.timeDigit}>{minutes.toString().padStart(2, '0')}</Text>
          <Pressable onPress={() => nudge('minute', -1)} hitSlop={10} style={styles.nudgeBtn}>
            <Ionicons name="chevron-down" size={18} color={palette.accentOrange} />
          </Pressable>
        </View>

        {/* AM / PM toggle */}
        <Pressable onPress={toggleAMPM} style={styles.ampmBtn}>
          <Text style={styles.ampmText}>{isPM ? 'PM' : 'AM'}</Text>
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
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [wearable, setWearable] = useState<WearableId>(null);
  const [calendar, setCalendar] = useState<CalendarId>(null);
  const [startTime, setStartTime] = useState(() => {
    const d = new Date(); d.setHours(9, 0, 0, 0); return d;
  });
  const [endTime, setEndTime] = useState(() => {
    const d = new Date(); d.setHours(18, 0, 0, 0); return d;
  });

  // Step transition animation
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const contentTranslateX = useRef(new Animated.Value(0)).current;
  // Page entrance
  const pageOpacity = useRef(new Animated.Value(0)).current;
  const pageTranslateY = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(pageOpacity, { toValue: 1, duration: 500, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(pageTranslateY, { toValue: 0, duration: 500, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start();
  }, []);

  const transitionToStep = (next: number) => {
    // Slide out left + fade
    Animated.parallel([
      Animated.timing(contentOpacity, { toValue: 0, duration: 180, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      Animated.timing(contentTranslateX, { toValue: -30, duration: 180, easing: Easing.in(Easing.ease), useNativeDriver: true }),
    ]).start(() => {
      setStep(next);
      contentTranslateX.setValue(30);
      // Slide in from right + fade
      Animated.parallel([
        Animated.timing(contentOpacity, { toValue: 1, duration: 260, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(contentTranslateX, { toValue: 0, duration: 260, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      ]).start();
    });
  };

  const saveAndNavigate = async (includeSelections: boolean) => {
    if (saving) return;
    setSaving(true);
    try {
      if (session) {
        const patch: Record<string, unknown> = {
          onboarding_complete: true,
          updated_at: new Date().toISOString(),
        };
        if (includeSelections) {
          patch.work_start_hour = startTime.getHours();
          patch.work_end_hour = endTime.getHours();
          patch.wearable_ios = wearable === 'apple-health' ? 'apple-health' : null;
          patch.wearable_android = wearable === 'google-fit' ? 'health-connect' : null;
        }
        await db.userSettings().update(patch).eq('user_id', session.user.id);
      }
    } catch {
      // Non-fatal: proceed anyway so users aren't locked out
    } finally {
      setSaving(false);
    }
    router.replace('/(main-screens)');
  };

  const finish = () => saveAndNavigate(true);
  const skip = () => saveAndNavigate(false);

  const handleContinue = () => {
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
          <>
            <Text style={styles.stepTitle}>Connect your wearable.</Text>
            <Text style={styles.stepSubtitle}>
              EMZ uses your health data to understand your energy and recovery — so it can protect both.
            </Text>
            <View style={styles.cardRow}>
              <SelectCard
                icon={<Ionicons name="heart" size={28} color="#FF3B5C" />}
                label="Apple Health"
                selected={wearable === 'apple-health'}
                onPress={() => setWearable(wearable === 'apple-health' ? null : 'apple-health')}
              />
              <SelectCard
                icon={<Ionicons name="fitness" size={28} color="#4285F4" />}
                label="Google Fit"
                selected={wearable === 'google-fit'}
                onPress={() => setWearable(wearable === 'google-fit' ? null : 'google-fit')}
              />
            </View>
            <Text style={styles.skipNote}>You can connect this later in Settings.</Text>
          </>
        );

      case 1:
        return (
          <>
            <Text style={styles.stepTitle}>Connect your calendar.</Text>
            <Text style={styles.stepSubtitle}>
              EMZ reads your schedule to plan around your real day — not an imaginary one.
            </Text>
            <View style={styles.cardRow}>
              <SelectCard
                icon={<Ionicons name="logo-google" size={28} color="#4285F4" />}
                label="Google Calendar"
                selected={calendar === 'google-calendar'}
                onPress={() => setCalendar(calendar === 'google-calendar' ? null : 'google-calendar')}
              />
              <SelectCard
                icon={<Ionicons name="logo-apple" size={28} color={palette.textPrimary} />}
                label="Apple Calendar"
                selected={calendar === 'apple-calendar'}
                onPress={() => setCalendar(calendar === 'apple-calendar' ? null : 'apple-calendar')}
              />
            </View>
            <Text style={styles.skipNote}>You can connect this later in Settings.</Text>
          </>
        );

      case 2:
        return (
          <>
            <Text style={styles.stepTitle}>Set your work hours.</Text>
            <Text style={styles.stepSubtitle}>
              EMZ won't schedule tasks outside these hours unless you ask it to.
            </Text>
            <View style={styles.timeRow2}>
              <TimeCard label="Start" time={startTime} onChange={setStartTime} />
              <TimeCard label="End" time={endTime} onChange={setEndTime} />
            </View>
          </>
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

          {/* Top row: dots + skip */}
          <View style={styles.topBar}>
            <ProgressDots step={step} />
            <Pressable onPress={skip} hitSlop={12} accessibilityRole="button" accessibilityLabel="Skip onboarding">
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
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
              label={isLastStep ? (saving ? 'Saving…' : 'Get started') : 'Continue'}
              onPress={saving ? () => {} : handleContinue}
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
    paddingTop: spacing.xl,
  },
  stepTitle: {
    fontSize: 30,
    fontFamily: fonts.display,
    color: colors.ink.primary,
    lineHeight: 36,
    marginBottom: 12,
  },
  stepSubtitle: {
    fontSize: 15,
    fontFamily: fonts.bodyRegular,
    color: colors.ink.secondary,
    lineHeight: 22,
    marginBottom: spacing.xl,
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

  // Time pickers
  timeRow2: {
    flexDirection: 'row',
    gap: 12,
  },
  timeCard: {
    flex: 1,
    borderRadius: borderRadius.card,
    borderWidth: 1,
    borderColor: colors.divider.strong,
    backgroundColor: palette.background,
    padding: 16,
    alignItems: 'center',
    gap: 12,
    ...cardShadow,
  },
  timeCardLabel: {
    fontSize: 11,
    fontFamily: fonts.bodyMedium,
    color: colors.ink.tertiary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeCol: {
    alignItems: 'center',
    gap: 6,
  },
  nudgeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeDigit: {
    fontSize: 28,
    fontFamily: fonts.display,
    color: colors.ink.primary,
    lineHeight: 32,
  },
  timeColon: {
    fontSize: 24,
    fontFamily: fonts.display,
    color: colors.ink.secondary,
    marginBottom: 4,
  },
  ampmBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,217,61,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,182,108,0.30)',
    marginLeft: 4,
  },
  ampmText: {
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
    color: palette.accentOrange,
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
