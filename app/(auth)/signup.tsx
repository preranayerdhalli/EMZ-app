import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Animated,
  Easing,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassInput } from '@/components/ui';
import { AuthBackground } from '@/components/AuthBackground';
import { colors, spacing, typography, fonts, palette, borderRadius, cardShadow } from '@/constants/theme';

// ─── Social icons ─────────────────────────────────────────────────────────────

const ICON_SIZE = 20;
const GoogleIcon = () => <Ionicons name="logo-google" size={ICON_SIZE} color="#4285F4" />;
const AppleIcon = () => <Ionicons name="logo-apple" size={ICON_SIZE} color={palette.textPrimary} />;

// ─── Social button ────────────────────────────────────────────────────────────

function SocialButton({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.socialBtn, pressed && styles.socialBtnPressed]}
    >
      <View style={styles.socialIcon}>{icon}</View>
      <Text style={styles.socialLabel}>{label}</Text>
    </Pressable>
  );
}

// ─── Divider ─────────────────────────────────────────────────────────────────

function OrDivider() {
  return (
    <View style={styles.orRow}>
      <View style={styles.orLine} />
      <Text style={styles.orText}>or continue with</Text>
      <View style={styles.orLine} />
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SignUpScreen() {
  const router = useRouter();
  const { signInWithEmail, signInWithGoogle, signInWithApple } = useAuth();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);

  // Animation values
  const backOpacity    = useRef(new Animated.Value(0)).current;
  const titleOpacity   = useRef(new Animated.Value(0)).current;
  const titleTranslate = useRef(new Animated.Value(20)).current;

  const formOpacity    = useRef(new Animated.Value(0)).current;
  const formTranslate  = useRef(new Animated.Value(28)).current;

  const row0 = useRef(new Animated.Value(0)).current; // email
  const row1 = useRef(new Animated.Value(0)).current; // primary CTA
  const row2 = useRef(new Animated.Value(0)).current; // divider
  const row3 = useRef(new Animated.Value(0)).current; // google (drops)
  const row4 = useRef(new Animated.Value(0)).current; // apple (drops)
  const row5 = useRef(new Animated.Value(0)).current; // footer links

  useEffect(() => {
    Animated.sequence([
      // Back button + title fade up
      Animated.parallel([
        Animated.timing(backOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(titleOpacity, { toValue: 1, duration: 400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(titleTranslate, { toValue: 0, duration: 400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      ]),
      // Form card rises
      Animated.delay(60),
      Animated.parallel([
        Animated.timing(formOpacity, { toValue: 1, duration: 360, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(formTranslate, { toValue: 0, duration: 360, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      ]),
      // Rows stagger — email + CTA fade up, then divider, then social drop
      Animated.stagger(75, [
        Animated.timing(row0, { toValue: 1, duration: 260, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(row1, { toValue: 1, duration: 260, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(row2, { toValue: 1, duration: 240, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(row3, { toValue: 1, duration: 300, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }),
        Animated.timing(row4, { toValue: 1, duration: 300, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }),
        Animated.timing(row5, { toValue: 1, duration: 260, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const fadeUp = (v: Animated.Value, offsetY = 12) => ({
    opacity: v,
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [offsetY, 0] }) }],
  });

  const dropDown = (v: Animated.Value) => ({
    opacity: v,
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
  });

  return (
    <AuthBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back button */}
          <Animated.View style={[styles.topRow, { opacity: backOpacity }]}>
            <Pressable
              onPress={() => router.back()}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
            >
              <Ionicons name="chevron-back" size={18} color={colors.ink.primary} />
            </Pressable>
          </Animated.View>

          {/* Title */}
          <Animated.View style={{ opacity: titleOpacity, transform: [{ translateY: titleTranslate }] }}>
            <Text style={styles.title}>Create your account.</Text>
            <Text style={styles.subtitle}>It only takes a moment.</Text>
          </Animated.View>

          {/* Form card */}
          <Animated.View style={[styles.formWrap, { opacity: formOpacity, transform: [{ translateY: formTranslate }] }]}>
            <View style={styles.formCard}>
              <LinearGradient
                colors={[palette.background, palette.backgroundSecondary]}
                start={{ x: 0.1, y: 0 }}
                end={{ x: 0.9, y: 1 }}
                style={StyleSheet.absoluteFill}
              />

              <View style={styles.formInner}>
                {/* Email */}
                <Animated.View style={fadeUp(row0)}>
                  <GlassInput
                    label="Email address"
                    placeholder="you@example.com"
                    value={email}
                    onChangeText={setEmail}
                    autoComplete="email"
                  />
                </Animated.View>

                {/* Primary CTA */}
                <Animated.View style={fadeUp(row1)}>
                  <Pressable
                    onPress={async () => {
                      if (!email.trim()) {
                        Alert.alert('Email required', 'Please enter your email address.');
                        return;
                      }
                      setSending(true);
                      try {
                        await signInWithEmail(email);
                        Alert.alert('Check your email', 'We sent you a sign-up link. Tap it to continue.');
                      } catch (e: any) {
                        Alert.alert('Error', e.message ?? 'Could not send sign-up link. Please try again.');
                      } finally {
                        setSending(false);
                      }
                    }}
                    style={({ pressed }) => [styles.primaryBtn, pressed && styles.primaryBtnPressed]}
                  >
                    <LinearGradient
                      colors={[palette.accentYellow, palette.accentOrangeLight]}
                      start={{ x: 0.1, y: 0 }}
                      end={{ x: 0.9, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    {sending
                      ? <ActivityIndicator color={palette.textPrimary} />
                      : <Text style={styles.primaryBtnText}>Send sign-up link</Text>
                    }
                  </Pressable>
                </Animated.View>

                {/* Divider */}
                <Animated.View style={fadeUp(row2)}>
                  <OrDivider />
                </Animated.View>

                {/* Social — dropdown */}
                <View style={styles.socialGroup}>
                  <Animated.View style={dropDown(row3)}>
                    <SocialButton
                      icon={<GoogleIcon />}
                      label="Continue with Google"
                      onPress={async () => {
                        try { await signInWithGoogle(); }
                        catch (e: any) { Alert.alert('Error', e.message); }
                      }}
                    />
                  </Animated.View>
                  <Animated.View style={dropDown(row4)}>
                    <SocialButton
                      icon={<AppleIcon />}
                      label="Continue with Apple"
                      onPress={async () => {
                        try { await signInWithApple(); }
                        catch (e: any) { Alert.alert('Error', e.message); }
                      }}
                    />
                  </Animated.View>
                </View>

                {/* Footer links */}
                <Animated.View style={[styles.footerLinks, { opacity: row5 }]}>
                  <Text style={styles.footerText}>Already have an account? </Text>
                  <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="link">
                    <Text style={styles.footerLink}>Log in</Text>
                  </Pressable>
                </Animated.View>
              </View>
            </View>
          </Animated.View>

          {/* Guest entry */}
          <Animated.View style={[styles.guestWrap, { opacity: row5 }]}>
            <Pressable
              onPress={() => router.replace('/(main-screens)')}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Enter app without signing in"
            >
              <Text style={styles.guestText}>Enter app without signing in</Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </AuthBackground>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: spacing.lg,
    paddingBottom: spacing['3xl'],
  },

  // Back
  topRow: { marginBottom: spacing.lg, alignItems: 'flex-end' },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(46,46,46,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider.strong,
  },
  backBtnPressed: {
    backgroundColor: 'rgba(255,217,61,0.12)',
    borderColor: 'rgba(255,217,61,0.22)',
  },

  // Title
  title: {
    color: colors.ink.primary,
    fontSize: 30,
    fontFamily: fonts.display,
    lineHeight: 36,
    marginBottom: 6,
  },
  subtitle: {
    color: colors.ink.secondary,
    fontSize: 15,
    fontFamily: fonts.bodyRegular,
    lineHeight: 22,
    marginBottom: spacing.xl,
  },

  // Form card
  formWrap: { marginBottom: spacing.lg },
  formCard: {
    borderRadius: borderRadius.card,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface.cardBorder,
    ...cardShadow,
  },
  formInner: {
    padding: 16,
    gap: 14,
  },

  // Primary button
  primaryBtn: {
    height: 52,
    borderRadius: borderRadius.button,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,182,108,0.30)',
  },
  primaryBtnPressed: { opacity: 0.92, transform: [{ scale: 0.985 }] },
  primaryBtnText: {
    fontSize: 16,
    fontFamily: fonts.bodyMedium,
    color: palette.textPrimary,
  },

  // Divider
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 4,
  },
  orLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider.strong,
  },
  orText: {
    fontSize: 12,
    fontFamily: fonts.bodyLight,
    color: colors.ink.tertiary,
    letterSpacing: 0.2,
  },

  // Social
  socialGroup: { gap: 10 },
  socialBtn: {
    height: 52,
    borderRadius: borderRadius.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderColor: colors.divider.strong,
    overflow: 'hidden',
  },
  socialBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.55)',
    transform: [{ scale: 0.985 }],
  },
  socialIcon: { alignItems: 'center', justifyContent: 'center' },
  socialLabel: {
    fontSize: 15,
    fontFamily: fonts.bodyMedium,
    color: colors.ink.primary,
  },

  // Footer
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingTop: 4,
  },
  footerText: {
    color: colors.ink.secondary,
    fontSize: typography.caption.fontSize,
    fontFamily: fonts.bodyRegular,
  },
  footerLink: {
    color: palette.accentOrange,
    fontSize: typography.caption.fontSize,
    fontFamily: fonts.bodyMedium,
  },

  // Guest
  guestWrap: {
    alignItems: 'center',
    paddingTop: spacing.md,
  },
  guestText: {
    color: colors.ink.tertiary,
    fontSize: typography.caption.fontSize,
    fontFamily: fonts.bodyLight,
  },
});
