import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
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

// ─── Divider with "or" ────────────────────────────────────────────────────────

function OrDivider() {
  return (
    <View style={styles.orRow}>
      <View style={styles.orLine} />
      <Text style={styles.orText}>or continue with</Text>
      <View style={styles.orLine} />
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

const HERO_SCALE_START = 0.68;
const HERO_CENTER_OFFSET = 140;

export default function LoginScreen() {
  const router = useRouter();
  const { signInWithEmail, verifyOtp, signInWithGoogle, signInWithApple } = useAuth();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);

  // Animation values
  const heroOpacity    = useRef(new Animated.Value(0)).current;
  const heroScale      = useRef(new Animated.Value(HERO_SCALE_START)).current;
  const heroTranslateY = useRef(new Animated.Value(HERO_CENTER_OFFSET)).current;

  const formOpacity    = useRef(new Animated.Value(0)).current;
  const formTranslateY = useRef(new Animated.Value(32)).current;

  // Individual row animations (email, cta, divider, google, apple)
  const row0 = useRef(new Animated.Value(0)).current; // email field
  const row1 = useRef(new Animated.Value(0)).current; // primary button
  const row2 = useRef(new Animated.Value(0)).current; // "or" divider
  const row3 = useRef(new Animated.Value(0)).current; // google — slides down
  const row4 = useRef(new Animated.Value(0)).current; // apple — slides down

  const footerOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      // 1. Hero pops in at center
      Animated.parallel([
        Animated.timing(heroOpacity, { toValue: 1, duration: 560, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.spring(heroScale, { toValue: 1, useNativeDriver: true, tension: 48, friction: 11 }),
      ]),
      // 2. Pause at center
      Animated.delay(900),
      // 3. Hero springs up to final position
      Animated.spring(heroTranslateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 52,
        friction: 14,
      }),
      // 4. Form card rises in
      Animated.delay(80),
      Animated.parallel([
        Animated.timing(formOpacity, { toValue: 1, duration: 380, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(formTranslateY, { toValue: 0, duration: 380, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      ]),
      // 5. Rows stagger in — email and CTA first, then divider, then social buttons "drop"
      Animated.stagger(80, [
        Animated.timing(row0, { toValue: 1, duration: 280, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(row1, { toValue: 1, duration: 280, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(row2, { toValue: 1, duration: 260, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        // Social buttons drop from above (negative translateY = slides down)
        Animated.timing(row3, { toValue: 1, duration: 320, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }),
        Animated.timing(row4, { toValue: 1, duration: 320, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }),
      ]),
      Animated.timing(footerOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  // Standard fade-up style
  const fadeUp = (v: Animated.Value, offsetY = 12) => ({
    opacity: v,
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [offsetY, 0] }) }],
  });

  // Dropdown style (slides in from above)
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
          {/* ── Hero ── */}
          <Animated.View
            style={[
              styles.heroSection,
              {
                opacity: heroOpacity,
                transform: [{ scale: heroScale }, { translateY: heroTranslateY }],
              },
            ]}
          >
            <Image
              source={require('@/assets/images/logo.png')}
              style={styles.logo}
              resizeMode="contain"
              accessibilityLabel="emz logo"
            />
            <Text style={styles.quote}>
              You're not a machine. You're a human.{'\n'}Don't feel guilty for loving yourself.
            </Text>
            <Text style={styles.quoteAttribution}>— Pre, Founder of EMZ</Text>
          </Animated.View>

          {/* ── Form card ── */}
          <Animated.View style={[styles.formWrap, { opacity: formOpacity, transform: [{ translateY: formTranslateY }] }]}>
            <View style={styles.formCard}>
              {/* Background gradient */}
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
                    editable={!otpSent}
                  />
                </Animated.View>

                {/* OTP input — shown after code is sent */}
                {otpSent && (
                  <GlassInput
                    label="6-digit code"
                    placeholder="123456"
                    value={otp}
                    onChangeText={(t) => setOtp(t.replace(/\D/g, '').slice(0, 6))}
                    keyboardType="number-pad"
                    autoComplete="one-time-code"
                  />
                )}

                {/* Primary CTA */}
                <Animated.View style={fadeUp(row1)}>
                  <Pressable
                    onPress={async () => {
                      if (!otpSent) {
                        if (!email.trim()) {
                          Alert.alert('Email required', 'Please enter your email address.');
                          return;
                        }
                        setSending(true);
                        try {
                          await signInWithEmail(email);
                          setOtpSent(true);
                        } catch (e: any) {
                          Alert.alert('Error', e.message ?? 'Could not send code. Please try again.');
                        } finally {
                          setSending(false);
                        }
                      } else {
                        if (otp.length < 6) {
                          Alert.alert('Code required', 'Please enter the 6-digit code from your email.');
                          return;
                        }
                        setVerifying(true);
                        try {
                          await verifyOtp(email, otp);
                          // AuthGuard handles navigation after session is set
                        } catch (e: any) {
                          Alert.alert('Invalid code', e.message ?? 'The code is incorrect or expired. Try resending.');
                        } finally {
                          setVerifying(false);
                        }
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
                    {(sending || verifying)
                      ? <ActivityIndicator color={palette.textPrimary} />
                      : <Text style={styles.primaryBtnText}>{otpSent ? 'Verify code' : 'Send login code'}</Text>
                    }
                  </Pressable>
                </Animated.View>

                {/* Resend / change email */}
                {otpSent && (
                  <View style={styles.resendRow}>
                    <Text style={styles.resendText}>Didn't get it? </Text>
                    <Pressable
                      hitSlop={8}
                      onPress={async () => {
                        setSending(true);
                        try {
                          await signInWithEmail(email);
                          setOtp('');
                          Alert.alert('Sent', 'A new code has been sent to your email.');
                        } catch (e: any) {
                          Alert.alert('Error', e.message ?? 'Could not resend.');
                        } finally {
                          setSending(false);
                        }
                      }}
                    >
                      <Text style={styles.resendLink}>Resend</Text>
                    </Pressable>
                    <Text style={styles.resendText}> · </Text>
                    <Pressable hitSlop={8} onPress={() => { setOtpSent(false); setOtp(''); }}>
                      <Text style={styles.resendLink}>Change email</Text>
                    </Pressable>
                  </View>
                )}

                {/* Divider */}
                <Animated.View style={fadeUp(row2)}>
                  <OrDivider />
                </Animated.View>

                {/* Social — dropdown */}
                <View style={styles.socialGroup}>
                  <Animated.View style={dropDown(row3)}>
                    <SocialButton
                      icon={<GoogleIcon />}
                      label="Sign in with Google"
                      onPress={async () => {
                        try { await signInWithGoogle(); }
                        catch (e: any) { Alert.alert('Error', e.message); }
                      }}
                    />
                  </Animated.View>
                  <Animated.View style={dropDown(row4)}>
                    <SocialButton
                      icon={<AppleIcon />}
                      label="Sign in with Apple"
                      onPress={async () => {
                        try { await signInWithApple(); }
                        catch (e: any) { Alert.alert('Error', e.message); }
                      }}
                    />
                  </Animated.View>
                </View>
              </View>
            </View>
          </Animated.View>

          {/* ── Footer ── */}
          <Animated.View style={[styles.footer, { opacity: footerOpacity }]}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <Pressable onPress={() => router.push('/(auth)/signup')} hitSlop={8} accessibilityRole="link">
              <Text style={styles.footerLink}>Get started</Text>
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
    paddingBottom: spacing.xl,
  },

  // Hero
  heroSection: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: 4,
  },
  logo: {
    width: 240,
    height: 128,
    marginBottom: spacing.md,
  },
  quote: {
    color: colors.ink.primary,
    fontSize: 17,
    fontFamily: fonts.display,
    textAlign: 'center',
    lineHeight: 25,
    marginBottom: 8,
  },
  quoteAttribution: {
    color: colors.ink.tertiary,
    fontSize: 12,
    fontFamily: fonts.bodyLight,
    textAlign: 'right',
    letterSpacing: 0.3,
    alignSelf: 'flex-end',
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

  // Social buttons
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

  // Resend / change email row
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  resendText: {
    color: colors.ink.tertiary,
    fontSize: 13,
    fontFamily: fonts.bodyRegular,
  },
  resendLink: {
    color: palette.accentOrange,
    fontSize: 13,
    fontFamily: fonts.bodyMedium,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 'auto',
    paddingTop: spacing.lg,
  },
  footerText: {
    color: colors.ink.secondary,
    fontSize: typography.body.fontSize,
    fontFamily: fonts.bodyRegular,
  },
  footerLink: {
    color: palette.accentOrange,
    fontSize: typography.body.fontSize,
    fontFamily: fonts.bodyMedium,
  },
});
