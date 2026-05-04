import { useState, useLayoutEffect, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  LayoutAnimation,
  Platform,
  UIManager,
  Modal,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  TextInput,
  Keyboard,
  Animated,
  Easing,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { AppBackground } from '@/components/AuthBackground';
import { ScreenHeaderTitle } from '@/components/ScreenHeader';
import { Card, ListRow } from '@/components/ui';
import { colors, borderRadius, typography, fonts, palette, cardShadow } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { db, supabase } from '@/services/supabase';
import {
  connectGoogleCalendar,
  syncAppleCalendar,
  connectMicrosoftCalendar,
  disconnectCalendar,
  getConnectedCalendars,
} from '@/services/calendar';
import { syncHealthData } from '@/services/health';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const INK     = colors.ink.primary;
const INK_SEC = colors.ink.secondary;
const INK_TER = colors.ink.tertiary;
const DIVIDER = colors.divider.subtle;

// ─── Helpers ───────────────────────────────────────────────────────────────────

function SectionLabel({ title }: { title: string }) {
  return <Text style={styles.sectionLabel}>{title}</Text>;
}

// ─── Theme Segmented Control ───────────────────────────────────────────────────

type ThemeMode = 'light' | 'dark';

function ThemeToggle({ selected, onSelect }: { selected: ThemeMode; onSelect: (m: ThemeMode) => void }) {
  return (
    <View style={styles.themeToggle}>
      {(['light', 'dark'] as ThemeMode[]).map((m) => {
        const active = selected === m;
        return (
          <Pressable
            key={m}
            style={[styles.themeChip, active && styles.themeChipActive]}
            onPress={() => onSelect(m)}
          >
            <Ionicons
              name={m === 'light' ? 'sunny' : 'moon'}
              size={12}
              color={active ? INK : INK_TER}
            />
            <Text style={[styles.themeChipText, active && styles.themeChipTextActive]}>
              {m === 'light' ? 'Light' : 'Dark'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Expandable Connect ────────────────────────────────────────────────────────

type ConnectOption = {
  id: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
};

const WEARABLE_OPTIONS: ConnectOption[] = [
  { id: 'samsung',      name: 'Samsung Health',icon: 'heart-outline',   iconColor: '#1428A0', iconBg: 'rgba(20,40,160,0.10)'  },
];

const CALENDAR_OPTIONS: ConnectOption[] = [
  { id: 'google-cal', name: 'Google Calendar', icon: 'logo-google',  iconColor: '#4285F4', iconBg: 'rgba(66,133,244,0.10)' },
  { id: 'outlook',    name: 'Outlook',          icon: 'mail-outline', iconColor: '#0078D4', iconBg: 'rgba(0,120,212,0.10)'  },
];

type ExpandableConnectProps = {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  label: string;
  subtitle: string;
  options: ConnectOption[];
  connectedIds: Set<string>;
  onToggle: (id: string) => void;
  showDivider?: boolean;
};

function ExpandableConnect({
  icon, iconColor, iconBg, label, subtitle,
  options, connectedIds, onToggle, showDivider = true,
}: ExpandableConnectProps) {
  const [expanded, setExpanded] = useState(false);
  const connectedCount = options.filter((o) => connectedIds.has(o.id)).length;

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((v) => !v);
  };

  return (
    <View>
      <Pressable style={({ pressed }) => [styles.connectRow, pressed && styles.pressed]} onPress={toggle}>
        <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={17} color={iconColor} />
        </View>
        <View style={styles.rowBody}>
          <Text style={styles.rowTitle}>{label}</Text>
          <Text style={styles.rowSub}>
            {connectedCount > 0 ? `${connectedCount} connected` : subtitle}
          </Text>
        </View>
        {connectedCount > 0 && !expanded && <View style={styles.connectedDot} />}
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={INK_TER}
        />
      </Pressable>

      {expanded && (
        <View style={styles.subList}>
          {options.map((opt, i) => {
            const connected = connectedIds.has(opt.id);
            return (
              <View key={opt.id}>
                {i > 0 && <View style={styles.subDivider} />}
                <Pressable
                  style={({ pressed }) => [styles.subRow, pressed && styles.pressed]}
                  onPress={() => onToggle(opt.id)}
                >
                  <View style={[styles.subIcon, { backgroundColor: opt.iconBg }]}>
                    <Ionicons name={opt.icon} size={14} color={opt.iconColor} />
                  </View>
                  <Text style={styles.subLabel}>{opt.name}</Text>
                  <View style={[styles.badge, connected && styles.badgeConnected]}>
                    {connected && <Ionicons name="checkmark" size={10} color="#4CAF50" />}
                    <Text style={[styles.badgeText, connected && styles.badgeTextConnected]}>
                      {connected ? 'Connected' : 'Connect'}
                    </Text>
                  </View>
                </Pressable>
              </View>
            );
          })}
        </View>
      )}

      {showDivider && <View style={styles.inlineDivider} />}
    </View>
  );
}

// ─── Reset Data Modal ─────────────────────────────────────────────────────────

const DANGER        = '#E8534A';
const DANGER_LIGHT  = 'rgba(232,83,74,0.10)';
const DANGER_MID    = 'rgba(232,83,74,0.18)';
const DANGER_BORDER = 'rgba(232,83,74,0.28)';

const ERASE_ITEMS = [
  { icon: 'checkmark-done-outline' as const, label: 'Tasks & schedules'       },
  { icon: 'heart-outline'          as const, label: 'Wellness & mood data'     },
  { icon: 'calendar-outline'       as const, label: 'Calendar connections'     },
  { icon: 'flash-outline'          as const, label: 'Recovery & energy scores' },
  { icon: 'settings-outline'       as const, label: 'Preferences & settings'   },
];

function ResetDataModal({
  visible,
  onClose,
  onReset,
  userEmail,
}: {
  visible: boolean;
  onClose: () => void;
  onReset: () => Promise<void>;
  userEmail?: string;
}) {
  const [email, setEmail]       = useState('');
  const [deleted, setDeleted]   = useState(false);
  const shakeAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim  = useRef(new Animated.Value(0.88)).current;
  const opacAnim   = useRef(new Animated.Value(0)).current;

  // Entrance / exit
  useEffect(() => {
    if (visible) {
      setEmail('');
      setDeleted(false);
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, bounciness: 6 }),
        Animated.timing(opacAnim,  { toValue: 1, duration: 220, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim, { toValue: 0.88, duration: 180, easing: Easing.in(Easing.ease), useNativeDriver: true }),
        Animated.timing(opacAnim,  { toValue: 0,    duration: 180, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const shake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue:  8, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  6, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  0, duration: 35, useNativeDriver: true }),
    ]).start();
  };

  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current); }, []);

  const handleDelete = async () => {
    if (!email.trim()) { shake(); return; }
    if (userEmail && email.trim().toLowerCase() !== userEmail.trim().toLowerCase()) {
      shake();
      return;
    }
    setDeleted(true);
    try { await onReset(); } catch { /* signOut navigates away — ignore */ }
    closeTimerRef.current = setTimeout(onClose, 1800);
  };

  const canDelete = email.trim().length > 0;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={rdStyles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Backdrop */}
        <Animated.View style={[rdStyles.backdrop, { opacity: opacAnim }]}>
          <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); onClose(); }}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
        </Animated.View>

        {/* Card */}
        <Animated.View
          style={[
            rdStyles.card,
            { opacity: opacAnim, transform: [{ scale: scaleAnim }, { translateX: shakeAnim }] },
          ]}
        >
          {/* Close */}
          <Pressable style={rdStyles.closeBtn} onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={20} color={INK_TER} />
          </Pressable>

          {deleted ? (
            /* ── Success state ── */
            <View style={rdStyles.successWrap}>
              <View style={rdStyles.successIcon}>
                <Ionicons name="checkmark" size={32} color={DANGER} />
              </View>
              <Text style={rdStyles.successTitle}>Data Deleted</Text>
              <Text style={rdStyles.successSub}>Your account has been wiped clean.</Text>
            </View>
          ) : (
            <>
              {/* ── Warning icon ── */}
              <View style={rdStyles.iconRing}>
                <View style={rdStyles.iconInner}>
                  <Ionicons name="warning" size={28} color={DANGER} />
                </View>
              </View>

              {/* ── Heading ── */}
              <Text style={rdStyles.title}>Delete All Data</Text>
              <Text style={rdStyles.subtitle}>
                This action is <Text style={rdStyles.bold}>permanent</Text> and cannot be undone.
                Every piece of data tied to your account will be erased.
              </Text>

              {/* ── What gets erased ── */}
              <View style={rdStyles.eraseBox}>
                <Text style={rdStyles.eraseHeading}>Everything being erased</Text>
                {ERASE_ITEMS.map((item) => (
                  <View key={item.label} style={rdStyles.eraseRow}>
                    <View style={rdStyles.eraseIconWrap}>
                      <Ionicons name={item.icon} size={13} color={DANGER} />
                    </View>
                    <Text style={rdStyles.eraseLabel}>{item.label}</Text>
                  </View>
                ))}
              </View>

              {/* ── Divider ── */}
              <View style={rdStyles.divider} />

              {/* ── Email confirmation ── */}
              <Text style={rdStyles.confirmLabel}>Enter your email to confirm</Text>
              <View style={[rdStyles.inputWrap, canDelete && rdStyles.inputWrapActive]}>
                <Ionicons name="mail-outline" size={16} color={canDelete ? DANGER : INK_TER} style={rdStyles.inputIcon} />
                <TextInput
                  style={rdStyles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="your@email.com"
                  placeholderTextColor="rgba(46,46,46,0.28)"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={handleDelete}
                />
              </View>

              {/* ── Actions ── */}
              <Pressable
                style={({ pressed }) => [
                  rdStyles.deleteBtn,
                  !canDelete && rdStyles.deleteBtnDisabled,
                  pressed && canDelete && rdStyles.deleteBtnPressed,
                ]}
                onPress={handleDelete}
              >
                <Ionicons
                  name="trash-outline"
                  size={16}
                  color={canDelete ? '#fff' : 'rgba(46,46,46,0.28)'}
                />
                <Text style={[rdStyles.deleteBtnText, !canDelete && rdStyles.deleteBtnTextDisabled]}>
                  Delete Permanently
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [rdStyles.cancelBtn, pressed && rdStyles.cancelBtnPressed]}
                onPress={onClose}
              >
                <Text style={rdStyles.cancelBtnText}>Cancel, keep my data</Text>
              </Pressable>
            </>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const rdStyles = StyleSheet.create({
  flex: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.50)',
  },
  card: {
    width: '88%',
    backgroundColor: '#FFFCF4',
    borderRadius: 24,
    padding: 24,
    paddingTop: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(46,46,46,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 16,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 4,
    zIndex: 1,
  },

  /* Icon */
  iconRing: {
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: DANGER_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: DANGER_BORDER,
  },
  iconInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: DANGER_MID,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Heading */
  title: {
    fontSize: 22,
    fontFamily: fonts.display,
    color: DANGER,
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: fonts.bodyRegular,
    color: INK_SEC,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 20,
  },
  bold: { fontFamily: fonts.bodyMedium, color: INK },

  /* Erase list */
  eraseBox: {
    backgroundColor: DANGER_LIGHT,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: DANGER_BORDER,
    padding: 14,
    gap: 10,
    marginBottom: 20,
  },
  eraseHeading: {
    fontSize: 11,
    fontFamily: fonts.bodyMedium,
    color: DANGER,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  eraseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  eraseIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: DANGER_MID,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  eraseLabel: {
    fontSize: 13,
    fontFamily: fonts.bodyRegular,
    color: INK,
  },

  /* Divider */
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(46,46,46,0.08)',
    marginBottom: 20,
  },

  /* Email input */
  confirmLabel: {
    fontSize: 11,
    fontFamily: fonts.bodyMedium,
    color: INK_TER,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderRadius: 12,
    backgroundColor: 'rgba(46,46,46,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(46,46,46,0.10)',
    paddingHorizontal: 14,
    gap: 10,
    marginBottom: 20,
  },
  inputWrapActive: {
    borderColor: DANGER_BORDER,
    backgroundColor: DANGER_LIGHT,
  },
  inputIcon: { flexShrink: 0 },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: fonts.bodyRegular,
    color: INK,
  },

  /* Delete button */
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 14,
    backgroundColor: DANGER,
    marginBottom: 10,
  },
  deleteBtnDisabled: {
    backgroundColor: 'rgba(46,46,46,0.07)',
  },
  deleteBtnPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  deleteBtnText: {
    fontSize: 15,
    fontFamily: fonts.bodyMedium,
    color: '#fff',
    letterSpacing: -0.1,
  },
  deleteBtnTextDisabled: {
    color: 'rgba(46,46,46,0.28)',
  },

  /* Cancel */
  cancelBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(46,46,46,0.10)',
    backgroundColor: 'transparent',
  },
  cancelBtnPressed: {
    backgroundColor: 'rgba(46,46,46,0.04)',
  },
  cancelBtnText: {
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
    color: INK_SEC,
  },

  /* Success */
  successWrap: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  successIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: DANGER_LIGHT,
    borderWidth: 1.5,
    borderColor: DANGER_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontSize: 20,
    fontFamily: fonts.display,
    color: DANGER,
    letterSpacing: -0.2,
  },
  successSub: {
    fontSize: 14,
    fontFamily: fonts.bodyLight,
    color: INK_SEC,
  },
});

// ─── Profile Edit Modal ───────────────────────────────────────────────────

type ProfileEditModalProps = {
  visible: boolean;
  name: string;
  email: string;
  onSave: (name: string, email: string) => void;
  onClose: () => void;
};

function ProfileEditModal({ visible, name, email, onSave, onClose }: ProfileEditModalProps) {
  const [draftName, setDraftName] = useState(name);
  const [draftEmail, setDraftEmail] = useState(email);
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setDraftName(name);
      setDraftEmail(email);
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        bounciness: 4,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [400, 0],
  });

  const backdropOpacity = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={pmStyles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); onClose(); }}>
          <Animated.View style={[pmStyles.backdrop, { opacity: backdropOpacity }]} />
        </TouchableWithoutFeedback>

        <Animated.View style={[pmStyles.sheet, { transform: [{ translateY }] }]}>
          {/* Handle */}
          <View style={pmStyles.handle} />

          {/* Header */}
          <View style={pmStyles.header}>
            <Text style={pmStyles.title}>Edit Profile</Text>
            <Pressable onPress={onClose} hitSlop={12} style={pmStyles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.ink.tertiary} />
            </Pressable>
          </View>

          {/* Avatar */}
          <View style={pmStyles.avatarWrap}>
            <View style={pmStyles.avatar}>
              <Text style={pmStyles.avatarInitial}>
                {draftName.trim().charAt(0).toUpperCase() || 'P'}
              </Text>
            </View>
          </View>

          {/* Fields */}
          <View style={pmStyles.fields}>
            <View style={pmStyles.fieldWrap}>
              <Text style={pmStyles.fieldLabel}>NAME</Text>
              <TextInput
                style={pmStyles.input}
                value={draftName}
                onChangeText={setDraftName}
                placeholder="Your name"
                placeholderTextColor={colors.ink.placeholder}
                autoCapitalize="words"
                returnKeyType="next"
              />
            </View>
            <View style={pmStyles.fieldWrap}>
              <Text style={pmStyles.fieldLabel}>EMAIL</Text>
              <TextInput
                style={pmStyles.input}
                value={draftEmail}
                onChangeText={setDraftEmail}
                placeholder="your@email.com"
                placeholderTextColor={colors.ink.placeholder}
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={() => { Keyboard.dismiss(); onSave(draftName, draftEmail); onClose(); }}
              />
            </View>
          </View>

          {/* Save */}
          <Pressable
            style={({ pressed }) => [pmStyles.saveBtn, pressed && pmStyles.saveBtnPressed]}
            onPress={() => { Keyboard.dismiss(); onSave(draftName, draftEmail); onClose(); }}
          >
            <Text style={pmStyles.saveBtnText}>Save Changes</Text>
          </Pressable>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const pmStyles = StyleSheet.create({
  flex: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    backgroundColor: colors.surface.sheet ?? '#FFFCF4',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 36,
    paddingTop: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface.cardBorder,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(46,46,46,0.14)',
    marginBottom: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontFamily: fonts.display,
    color: colors.ink.primary,
    letterSpacing: -0.2,
  },
  closeBtn: {
    padding: 4,
  },
  avatarWrap: {
    alignSelf: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: palette.accentOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 28,
    fontFamily: fonts.display,
    color: '#fff',
    letterSpacing: -0.5,
  },
  cameraChip: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: palette.accentOrangeLight ?? palette.accentOrange,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface.sheet ?? '#FFFCF4',
  },
  photoHint: {
    alignSelf: 'center',
    fontSize: 12,
    fontFamily: fonts.bodyLight,
    color: colors.ink.tertiary,
    marginBottom: 24,
  },
  fields: { gap: 16, marginBottom: 28 },
  fieldWrap: { gap: 6 },
  fieldLabel: {
    fontSize: typography.micro.fontSize,
    lineHeight: typography.micro.lineHeight,
    fontFamily: fonts.bodyMedium,
    color: colors.ink.tertiary,
    letterSpacing: 0.8,
  },
  input: {
    height: 50,
    borderRadius: borderRadius.input ?? borderRadius.card,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: fonts.bodyRegular,
    color: colors.ink.primary,
    backgroundColor: colors.control.fieldBg,
    borderWidth: 1,
    borderColor: colors.control.fieldBorder,
  },
  saveBtn: {
    height: 52,
    borderRadius: borderRadius.button ?? borderRadius.card,
    backgroundColor: palette.accentYellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnPressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
  saveBtnText: {
    fontSize: 16,
    fontFamily: fonts.bodyMedium,
    color: palette.textPrimary ?? colors.ink.primary,
    letterSpacing: -0.1,
  },
});

// ─── Screen ────────────────────────────────────────────────────────────────────

type SettingsCalendarId = 'google-cal' | 'apple-cal' | 'outlook';
type SettingsWearableId = 'apple-health' | 'samsung';

const CALENDAR_ID_TO_PROVIDER: Record<SettingsCalendarId, 'google' | 'microsoft' | 'apple'> = {
  'google-cal': 'google',
  'outlook': 'microsoft',
  'apple-cal': 'apple',
};

const COMING_SOON_IDS = new Set<SettingsCalendarId | SettingsWearableId>(['outlook']);

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { signOut, user } = useAuth();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => <ScreenHeaderTitle title="Settings" subtitle="Account & preferences" />,
    });
  }, [navigation]);

  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<ThemeMode>('light');
  const [notifications,  setNotifications]  = useState(true);
  const [dailyDigest,    setDailyDigest]    = useState(true);
  const [smartReminders, setSmartReminders] = useState(false);
  const [weeklyReport,   setWeeklyReport]   = useState(true);
  const [hapticFeedback, setHapticFeedback] = useState(true);
  const [connectedIds,   setConnectedIds]   = useState<Set<string>>(new Set());
  const [resetModalOpen, setResetModalOpen] = useState(false);

  // user?.id is stable; avoids re-running on unrelated auth events
  useEffect(() => {
    if (!user) return;
    setProfileEmail(user.email ?? '');
    const meta = user.user_metadata as Record<string, unknown> | undefined;
    const name = (meta?.full_name ?? meta?.name ?? '') as string;
    setProfileName(name || (user.email ?? '').split('@')[0]);
  }, [user?.id]);

  useEffect(() => {
    const load = async () => {
      const ids = new Set<string>();
      const providers = await getConnectedCalendars().catch(() => new Set<string>());
      if (providers.has('google'))    ids.add('google-cal');
      if (providers.has('microsoft')) ids.add('outlook');
      if (providers.has('apple'))     ids.add('apple-cal');
      if (Platform.OS === 'ios')      ids.add('apple-health');
      if (Platform.OS === 'android') ids.add('health-connect');
      setConnectedIds(ids);
    };
    load();
  }, [user?.id]);

  const toggleCalendarConnection = async (id: SettingsCalendarId) => {
    if (COMING_SOON_IDS.has(id)) {
      Alert.alert('Coming Soon', 'This integration will be available in a future update.');
      return;
    }
    const provider = CALENDAR_ID_TO_PROVIDER[id];
    if (connectedIds.has(id)) {
      await disconnectCalendar(provider);
      setConnectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
      return;
    }
    if (id === 'google-cal') {
      const ok = await connectGoogleCalendar();
      if (ok) setConnectedIds((prev) => new Set(prev).add(id));
    } else if (id === 'apple-cal') {
      await syncAppleCalendar();
      setConnectedIds((prev) => new Set(prev).add(id));
    }
  };

  const toggleWearableConnection = async (id: SettingsWearableId) => {
    if (COMING_SOON_IDS.has(id)) {
      Alert.alert('Coming Soon', 'This integration will be available in a future update.');
      return;
    }
    if (connectedIds.has(id)) {
      setConnectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    } else {
      await syncHealthData();
      setConnectedIds((prev) => new Set(prev).add(id));
    }
  };

  const handleProfileSave = async (n: string, _e: string) => {
    setProfileName(n);
    if (!user) return;
    try {
      await db.users().update({ full_name: n.trim() || null }).eq('id', user.id);
      await supabase.auth.updateUser({ data: { full_name: n.trim() || null } });
    } catch { /* Non-critical — local state already updated */ }
  };

  const handleResetData = async () => {
    if (!user) return;
    await Promise.all([
      db.tasks().delete().eq('user_id', user.id),
      db.moodCheckins().delete().eq('user_id', user.id),
      db.biometricReadings().delete().eq('user_id', user.id),
      db.energyForecasts().delete().eq('user_id', user.id),
      db.calendarEvents().delete().eq('user_id', user.id),
      db.calendarTokens().delete().eq('user_id', user.id),
      db.dailySummaries().delete().eq('user_id', user.id),
    ]);
    // Reset onboarding so user re-enters setup on next login
    await db.userSettings()
      .update({ onboarding_complete: false })
      .eq('user_id', user.id);
    await signOut();
  };

  const sw = {
    track: { false: 'rgba(46,46,46,0.10)', true: 'rgba(255,215,0,0.40)' },
    thumb: (on: boolean) => on ? colors.brandGold : 'rgba(46,46,46,0.28)',
  };

  const displayName = profileName || profileEmail.split('@')[0];
  const avatarInitial = displayName.charAt(0).toUpperCase() || 'E';

  return (
    <AppBackground>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Profile ────────────────────────────────────────────────────── */}
        <Pressable onPress={() => setProfileModalOpen(true)} style={styles.profileHeroPressable}>
          <View style={styles.profileHero}>
            <View style={styles.avatarRing}>
              <LinearGradient
                colors={[palette.accentYellow, palette.accentOrangeLight]}
                style={styles.avatar}
                start={{ x: 0.2, y: 0 }}
                end={{ x: 0.8, y: 1 }}
              >
                <Text style={styles.avatarInitial}>{avatarInitial}</Text>
              </LinearGradient>
            </View>
            <View style={styles.profileNameColumn}>
              <Text style={styles.profileName}>{displayName}</Text>
              {profileEmail && <Text style={styles.profileEmail}>{profileEmail}</Text>}
            </View>
          </View>
        </Pressable>

        {/* ── Appearance ─────────────────────────────────────────────────── */}
        <SectionLabel title="Appearance" />
        <Card variant="cardStrong" inset={false} style={styles.card}>
          <View style={styles.themeRow}>
            <View style={[styles.iconWrap, { backgroundColor: 'rgba(46,46,46,0.05)' }]}>
              <Ionicons name="color-palette-outline" size={17} color={INK_SEC} />
            </View>
            <Text style={styles.rowTitle}>Theme</Text>
            <ThemeToggle selected={selectedTheme} onSelect={setSelectedTheme} />
          </View>
        </Card>

        {/* ── Connections ────────────────────────────────────────────────── */}
        <SectionLabel title="Connections" />
        <Card variant="cardStrong" inset={false} style={styles.card}>
          <ExpandableConnect
            icon="watch-outline"
            iconColor={colors.brandGold}
            iconBg="rgba(255,217,61,0.12)"
            label="Connect Wearable"
            subtitle="Sync health & fitness data"
            options={WEARABLE_OPTIONS}
            connectedIds={connectedIds}
            onToggle={(id) => toggleWearableConnection(id as SettingsWearableId)}
          />
          <ExpandableConnect
            icon="calendar-outline"
            iconColor="#7FA57A"
            iconBg="rgba(127,165,122,0.12)"
            label="Connect Calendar"
            subtitle="Sync events & schedule"
            options={CALENDAR_OPTIONS}
            connectedIds={connectedIds}
            onToggle={(id) => toggleCalendarConnection(id as SettingsCalendarId)}
            showDivider={false}
          />
        </Card>

        {/* ── Notifications ──────────────────────────────────────────────── */}
        <SectionLabel title="Notifications" />
        <Card variant="cardStrong" inset={false} style={styles.card}>
          <ListRow
            icon="notifications-outline"
            iconBg="rgba(255,138,42,0.10)"
            iconColor={colors.brandOrange}
            title="Push Notifications"
            right={<Switch value={notifications} onValueChange={setNotifications} trackColor={sw.track} thumbColor={sw.thumb(notifications)} />}
          />
          <ListRow
            icon="sunny-outline"
            iconBg="rgba(255,217,61,0.14)"
            iconColor={colors.brandGold}
            title="Morning Digest"
            subtitle="Daily summary at 8am"
            right={<Switch value={dailyDigest} onValueChange={setDailyDigest} trackColor={sw.track} thumbColor={sw.thumb(dailyDigest)} />}
          />
          <ListRow
            icon="flash-outline"
            iconBg="rgba(127,165,122,0.12)"
            iconColor="#7FA57A"
            title="Smart Reminders"
            subtitle="AI-timed nudges based on your energy"
            right={<Switch value={smartReminders} onValueChange={setSmartReminders} trackColor={sw.track} thumbColor={sw.thumb(smartReminders)} />}
          />
          <ListRow
            icon="bar-chart-outline"
            iconBg="rgba(127,165,122,0.12)"
            iconColor="#7FA57A"
            title="Weekly Report"
            subtitle="Progress summary every Sunday"
            right={<Switch value={weeklyReport} onValueChange={setWeeklyReport} trackColor={sw.track} thumbColor={sw.thumb(weeklyReport)} />}
            showDivider={false}
          />
        </Card>

        {/* ── App ────────────────────────────────────────────────────────── */}
        <SectionLabel title="App" />
        <Card variant="cardStrong" inset={false} style={styles.card}>
          <ListRow
            icon="phone-portrait-outline"
            iconBg="rgba(46,46,46,0.05)"
            iconColor={INK_SEC}
            title="Haptic Feedback"
            right={<Switch value={hapticFeedback} onValueChange={setHapticFeedback} trackColor={sw.track} thumbColor={sw.thumb(hapticFeedback)} />}
          />
          <ListRow
            icon="lock-closed-outline"
            iconBg="rgba(46,46,46,0.05)"
            iconColor={INK_SEC}
            title="Privacy & Security"
            subtitle="Biometrics, data permissions"
            onPress={() => {}}
          />
          <ListRow
            icon="cloud-download-outline"
            iconBg="rgba(46,46,46,0.05)"
            iconColor={INK_SEC}
            title="Export Data"
            subtitle="Download your wellness data"
            onPress={() => {}}
          />
          <ListRow
            icon="trash-outline"
            iconBg={DANGER_LIGHT}
            iconColor={DANGER}
            title="Reset Data"
            subtitle="Permanently erase all your data"
            destructive
            onPress={() => setResetModalOpen(true)}
            showDivider={false}
          />
        </Card>

        {/* ── Support ────────────────────────────────────────────────────── */}
        <SectionLabel title="Support" />
        <Card variant="cardStrong" inset={false} style={styles.card}>
          <ListRow
            icon="help-circle-outline"
            iconBg="rgba(127,165,122,0.12)"
            iconColor="#7FA57A"
            title="Help & FAQ"
            onPress={() => Alert.alert('Help & FAQ', 'Full FAQ coming soon. In the meantime, send us feedback and we\'ll reply directly.')}
          />
          <ListRow
            icon="chatbubble-ellipses-outline"
            iconBg="rgba(127,165,122,0.12)"
            iconColor="#7FA57A"
            title="Send Feedback"
            onPress={() => Linking.openURL('mailto:infoemz.au@gmail.com?subject=EMZ%20Feedback')}
          />
          <ListRow
            icon="document-text-outline"
            iconBg="rgba(46,46,46,0.05)"
            iconColor={INK_SEC}
            title="Terms & Privacy Policy"
            onPress={() => Alert.alert('Coming Soon', 'Terms and Privacy Policy will be available before public launch.')}
          />
          <ListRow
            icon="information-circle-outline"
            iconBg="rgba(46,46,46,0.05)"
            iconColor={INK_SEC}
            title="About EMZ"
            subtitle="Version 1.0.0"
            showDivider={false}
          />
        </Card>

        {/* ── Sign Out ───────────────────────────────────────────────────── */}
        <Pressable
          style={({ pressed }) => [styles.signOutBtn, pressed && styles.signOutBtnPressed]}
          onPress={signOut}
        >
          <LinearGradient
            colors={[palette.accentYellow, palette.accentOrangeLight]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Ionicons name="log-out-outline" size={17} color={palette.textPrimary} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>

      </ScrollView>

      <ProfileEditModal
        visible={profileModalOpen}
        name={profileName}
        email={profileEmail}
        onSave={handleProfileSave}
        onClose={() => setProfileModalOpen(false)}
      />
      <ResetDataModal
        visible={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        onReset={handleResetData}
        userEmail={profileEmail}
      />
    </AppBackground>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },

  /* Section label */
  sectionLabel: {
    fontSize: typography.micro.fontSize,
    lineHeight: typography.micro.lineHeight,
    fontFamily: fonts.bodyMedium,
    color: INK_TER,
    letterSpacing: typography.micro.letterSpacing,
    textTransform: typography.micro.textTransform,
    marginBottom: 8,
    marginTop: 22,
    paddingHorizontal: 4,
  },

  /* Card shell */
  card: {
    borderRadius: borderRadius.card,
    overflow: 'hidden',
  },

  /* ── Profile ─────────────────────────────────────────────────────────── */
  profileHeroPressable: {
    marginBottom: 12,
  },
  profileHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: borderRadius.card,
    backgroundColor: 'rgba(255,217,61,0.05)',
  },
  avatarRing: {
    padding: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(255,217,61,0.30)',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 18,
    fontFamily: fonts.display,
    color: '#fff',
    letterSpacing: -0.3,
  },
  profileName: {
    fontSize: 17,
    fontFamily: fonts.display,
    color: colors.ink.primary,
    letterSpacing: -0.2,
  },
  profileNameColumn: {
    gap: 2,
    flex: 1,
  },
  profileEmail: {
    fontSize: 12,
    fontFamily: fonts.bodyLight,
    color: colors.ink.tertiary,
  },

  /* ── Appearance ──────────────────────────────────────────────────────── */
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  themeToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(46,46,46,0.06)',
    borderRadius: borderRadius.pill,
    padding: 3,
    gap: 2,
  },
  themeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: borderRadius.pill,
  },
  themeChipActive: {
    backgroundColor: palette.background,
    ...cardShadow,
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  themeChipText: {
    fontSize: 12,
    fontFamily: fonts.bodyMedium,
    color: INK_TER,
  },
  themeChipTextActive: { color: INK },

  /* ── Shared row primitives ───────────────────────────────────────────── */
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowBody:  { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontFamily: fonts.bodyMedium, color: INK },
  rowSub:   { fontSize: 12, fontFamily: fonts.bodyLight,  color: INK_TER, lineHeight: 16 },
  pressed:  { backgroundColor: 'rgba(255,217,61,0.06)' },

  /* ── Connections ─────────────────────────────────────────────────────── */
  connectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  inlineDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: DIVIDER,
    marginLeft: 16 + 34 + 12,
  },
  connectedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4CAF50',
    marginRight: 2,
  },
  subList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DIVIDER,
    backgroundColor: 'rgba(46,46,46,0.014)',
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingLeft: 26,
    paddingRight: 16,
    gap: 10,
  },
  subDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: DIVIDER,
    marginLeft: 60,
  },
  subIcon: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  subLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.bodyRegular,
    color: INK,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(46,46,46,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(46,46,46,0.10)',
    flexShrink: 0,
  },
  badgeConnected: {
    backgroundColor: 'rgba(76,175,80,0.08)',
    borderColor: 'rgba(76,175,80,0.25)',
  },
  badgeText:          { fontSize: 11, fontFamily: fonts.bodyMedium, color: INK_SEC   },
  badgeTextConnected: { fontSize: 11, fontFamily: fonts.bodyMedium, color: '#4CAF50' },

  /* ── Sign Out ────────────────────────────────────────────────────────── */
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 28,
    height: 52,
    borderRadius: borderRadius.button,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,182,108,0.30)',
  },
  signOutBtnPressed: { opacity: 0.92, transform: [{ scale: 0.985 }] },
  signOutText: { fontSize: 16, fontFamily: fonts.bodyMedium, color: palette.textPrimary },
});
