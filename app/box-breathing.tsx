import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  StatusBar,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, router } from 'expo-router';
import { fonts } from '@/constants/theme';

// ─── Sizing ───────────────────────────────────────────────────────────────────

const { width: SCREEN_W } = Dimensions.get('window');
const ORB = Math.min(218, SCREEN_W * 0.54);
const G1  = ORB + 58;    // innermost halo
const G2  = ORB + 124;   // mid halo
const G3  = ORB + 218;   // outer corona

// ─── Phase config ─────────────────────────────────────────────────────────────

type Phase = {
  label: 'Inhale' | 'Hold' | 'Exhale';
  targetScale: number;
  targetGlowScale: number;
  grad: [string, string, string];
  glow: string;
};

const PHASES: [Phase, Phase, Phase, Phase] = [
  { label: 'Inhale', targetScale: 1.00, targetGlowScale: 1.20, grad: ['#FFE870', '#FFBA00', '#FF7800'], glow: '#FFB600' },
  { label: 'Hold',   targetScale: 1.00, targetGlowScale: 1.20, grad: ['#FFD060', '#FF9E00', '#FF5E00'], glow: '#FF9E00' },
  { label: 'Exhale', targetScale: 0.55, targetGlowScale: 0.82, grad: ['#FF9A52', '#E05600', '#A02C00'], glow: '#E05600' },
  { label: 'Hold',   targetScale: 0.55, targetGlowScale: 0.82, grad: ['#FFBF72', '#FF8600', '#C63E00'], glow: '#FF8600' },
];

const IDLE_GRAD: [string, string, string] = ['#FFDA4A', '#FF9500', '#FF5800'];
const IDLE_GLOW = '#FF9500';

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function BoxBreathingScreen() {
  const { intent = 'Release tension, reset your mind' } = useLocalSearchParams<{ intent?: string }>();

  const [running,   setRunning]   = useState(false);
  const [phaseIdx,  setPhaseIdx]  = useState<0 | 1 | 2 | 3>(0);
  const [countdown, setCountdown] = useState(4);
  const [rounds,    setRounds]    = useState(0);

  // ── Animated values ─────────────────────────────────────────────────────────
  const orbScale    = useRef(new Animated.Value(0.58)).current;
  const numOpacity  = useRef(new Animated.Value(1)).current;
  const morphX      = useRef(new Animated.Value(1)).current;
  const morphY      = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0.30)).current; // dim glow at idle
  const glowScale   = useRef(new Animated.Value(1)).current;

  // Derived per-layer opacities via interpolate (stable refs)
  const gO3 = useRef(glowOpacity.interpolate({ inputRange: [0, 1], outputRange: [0, 0.10] })).current;
  const gO2 = useRef(glowOpacity.interpolate({ inputRange: [0, 1], outputRange: [0, 0.20] })).current;
  const gO1 = useRef(glowOpacity.interpolate({ inputRange: [0, 1], outputRange: [0, 0.34] })).current;

// ── Animation refs ──────────────────────────────────────────────────────────
  const runningRef  = useRef(false);
  const totalRef    = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scaleRef    = useRef<Animated.CompositeAnimation | null>(null);
  const morphRef    = useRef<Animated.CompositeAnimation | null>(null);
  const idleRef     = useRef<Animated.CompositeAnimation | null>(null);
  const glowLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const startIdlePulse = useCallback(() => {
    idleRef.current?.stop();
    idleRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(orbScale, { toValue: 0.63, duration: 2700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(orbScale, { toValue: 0.53, duration: 2700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    idleRef.current.start();
  }, [orbScale]);

  const startMorphLoop = useCallback(() => {
    morphRef.current?.stop();
    morphRef.current = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(morphX, { toValue: 1.045, duration: 3400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(morphY, { toValue: 0.955, duration: 3400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(morphX, { toValue: 1.0, duration: 3400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(morphY, { toValue: 1.0, duration: 3400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      ])
    );
    morphRef.current.start();
  }, [morphX, morphY]);

  const animToScale = useCallback((target: number, dur: number) => {
    scaleRef.current?.stop();
    scaleRef.current = Animated.timing(orbScale, {
      toValue: target, duration: dur,
      easing: Easing.inOut(Easing.ease), useNativeDriver: true,
    });
    scaleRef.current.start();
  }, [orbScale]);

  const animGlowScale = useCallback((target: number, dur: number) => {
    glowLoopRef.current?.stop();
    glowLoopRef.current = Animated.timing(glowScale, {
      toValue: target, duration: dur,
      easing: Easing.inOut(Easing.ease), useNativeDriver: true,
    });
    glowLoopRef.current.start();
  }, [glowScale]);

  // ── Mount: idle pulse ────────────────────────────────────────────────────────
  useEffect(() => {
    startIdlePulse();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      scaleRef.current?.stop();
      morphRef.current?.stop();
      idleRef.current?.stop();
      glowLoopRef.current?.stop();
    };
  }, []);

  // ── Countdown flash ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!running) return;
    numOpacity.setValue(0.15);
    Animated.timing(numOpacity, { toValue: 1, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
  }, [countdown, running]);

  // ── Start ────────────────────────────────────────────────────────────────────
  const startBreathing = useCallback(() => {
    totalRef.current = 0;
    runningRef.current = true;
    setRunning(true);
    setPhaseIdx(0);
    setCountdown(4);
    setRounds(0);

    idleRef.current?.stop();

    Animated.timing(glowOpacity, { toValue: 1, duration: 900, useNativeDriver: true }).start();

    glowScale.setValue(0.82);
    startMorphLoop();
    animToScale(1.0, 4000);
    animGlowScale(1.20, 4000);

    intervalRef.current = setInterval(() => {
      if (!runningRef.current) return;
      totalRef.current += 1;
      const e   = totalRef.current;
      const pi  = (Math.floor(e / 4) % 4) as 0 | 1 | 2 | 3;
      const eip = e % 4;
      setCountdown(eip === 0 ? 4 : 4 - eip);
      if (eip === 0 && e > 0) {
        if (pi === 0) setRounds(r => r + 1);
        setPhaseIdx(pi);
        if (PHASES[pi].label !== 'Hold') {
          animToScale(PHASES[pi].targetScale, 4000);
          animGlowScale(PHASES[pi].targetGlowScale, 4000);
        }
      }
    }, 1000);
  }, [animGlowScale, animToScale, glowOpacity, glowScale, startMorphLoop]);

  // ── Stop ─────────────────────────────────────────────────────────────────────
  const stopBreathing = useCallback(() => {
    runningRef.current = false;
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    scaleRef.current?.stop();
    morphRef.current?.stop();
    glowLoopRef.current?.stop();
    setPhaseIdx(0);
    setCountdown(4);

    Animated.parallel([
      Animated.timing(glowOpacity, { toValue: 0.30, duration: 700, useNativeDriver: true }),
      Animated.spring(morphX,   { toValue: 1, useNativeDriver: true, tension: 80, friction: 12 }),
      Animated.spring(morphY,   { toValue: 1, useNativeDriver: true, tension: 80, friction: 12 }),
      Animated.spring(glowScale,{ toValue: 1, useNativeDriver: true, tension: 80, friction: 12 }),
    ]).start(() => {
      orbScale.setValue(0.58);
      startIdlePulse();
    });
  }, [glowOpacity, morphX, morphY, glowScale, orbScale, startIdlePulse]);

  const phase   = PHASES[phaseIdx];
  const orbGrad = running ? phase.grad : IDLE_GRAD;
  const glowCol = running ? phase.glow : IDLE_GLOW;

  return (
    <LinearGradient colors={['#0C0905', '#141009', '#0C0905']} style={styles.root}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.safe}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <Pressable
            onPress={() => { stopBreathing(); router.back(); }}
            hitSlop={14}
            style={styles.hSide}
          >
            <Ionicons name="chevron-down" size={26} color="rgba(255,245,228,0.60)" />
          </Pressable>
          <Text style={styles.hTitle}>BOX BREATHING</Text>
          <View style={styles.hSide} />
        </View>

        {/* ── Meta ── */}
        <View style={styles.meta}>
          {running && rounds > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {rounds} {rounds === 1 ? 'round' : 'rounds'} complete
              </Text>
            </View>
          ) : (
            <Text style={styles.intent}>{intent}</Text>
          )}
        </View>

        {/* ── Orb area ── */}
        <View style={styles.orbArea}>

          {/* Glow corona layers — outermost to innermost */}
          <Animated.View style={[styles.g3, { backgroundColor: glowCol, opacity: gO3, transform: [{ scale: glowScale }] }]} />
          <Animated.View style={[styles.g2, { backgroundColor: glowCol, opacity: gO2, transform: [{ scale: glowScale }] }]} />
          <Animated.View style={[styles.g1, { backgroundColor: glowCol, opacity: gO1, transform: [{ scale: glowScale }] }]} />

          {/* Main orb */}
          <Animated.View
            style={[
              styles.orbWrap,
              { shadowColor: glowCol, transform: [{ scale: orbScale }, { scaleX: morphX }, { scaleY: morphY }] },
            ]}
          >
            <LinearGradient
              colors={orbGrad}
              start={{ x: 0.10, y: 0.05 }}
              end={{ x: 0.94, y: 0.97 }}
              style={styles.orb}
            >
              {/* Top-left lens flare — 3D sphere illusion */}
              <View style={styles.hl1} />
              <View style={styles.hl2} />

              {/* Orb content */}
              {running && (
                <View style={styles.orbContent}>
                  <Animated.Text style={[styles.countNum, { opacity: numOpacity }]}>
                    {countdown}
                  </Animated.Text>
                  <Text style={styles.phaseLabel}>{phase.label.toUpperCase()}</Text>
                </View>
              )}
            </LinearGradient>
          </Animated.View>

        </View>

        {/* ── Phase indicator ── */}
        <View style={styles.phaseRow}>
          {PHASES.map((p, i) => (
            <View key={i} style={styles.phaseItem}>
              <View style={[
                styles.dot,
                {
                  backgroundColor: running && phaseIdx === i
                    ? PHASES[i].glow
                    : 'rgba(255,245,228,0.15)',
                  width: running && phaseIdx === i ? 24 : 7,
                },
              ]} />
              <Text style={[
                styles.dotLabel,
                {
                  color: running && phaseIdx === i
                    ? 'rgba(255,245,228,0.82)'
                    : 'rgba(255,245,228,0.26)',
                },
              ]}>
                {p.label}
              </Text>
            </View>
          ))}
        </View>

        {/* ── Pattern ── */}
        <Text style={styles.pattern}>4 · 4 · 4 · 4</Text>

        {/* ── CTA ── */}
        <View style={styles.btnWrap}>
          <Pressable onPress={running ? stopBreathing : startBreathing} style={styles.btn}>
            <LinearGradient
              colors={running ? ['#FF6500', '#FF2800'] : ['#FFD84A', '#FFA800']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.btnGrad}
            >
              <Text style={[styles.btnText, { color: running ? '#FFF5E4' : '#1A1208' }]}>
                {running ? 'End Session' : 'Begin Session'}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>

      </SafeAreaView>
    </LinearGradient>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  hSide:  { width: 44, alignItems: 'center' },
  hTitle: {
    fontSize: 11,
    fontFamily: fonts.bodyMedium,
    color: 'rgba(255,245,228,0.48)',
    letterSpacing: 2.8,
  },

  // ── Meta ────────────────────────────────────────────────────────────────────
  meta: {
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  intent: {
    fontSize: 15,
    fontFamily: fonts.bodyLight,
    color: 'rgba(255,245,228,0.42)',
    textAlign: 'center',
    lineHeight: 22,
  },
  badge: {
    backgroundColor: 'rgba(255,176,0,0.12)',
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,176,0,0.22)',
  },
  badgeText: {
    fontSize: 12,
    fontFamily: fonts.bodyMedium,
    color: '#FFB000',
    letterSpacing: 0.2,
  },

  // ── Orb area ────────────────────────────────────────────────────────────────
  orbArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Glow halos
  g3: { position: 'absolute', width: G3, height: G3, borderRadius: G3 / 2 },
  g2: { position: 'absolute', width: G2, height: G2, borderRadius: G2 / 2 },
  g1: { position: 'absolute', width: G1, height: G1, borderRadius: G1 / 2 },

  // Orb
  orbWrap: {
    width: ORB,
    height: ORB,
    borderRadius: ORB / 2,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.60,
    shadowRadius: 52,
    elevation: 24,
  },
  orb: {
    width: ORB,
    height: ORB,
    borderRadius: ORB / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  // Lens flare
  hl1: {
    position: 'absolute',
    width:  ORB * 0.46,
    height: ORB * 0.25,
    borderRadius: ORB * 0.13,
    backgroundColor: 'rgba(255,255,255,0.40)',
    top:  ORB * 0.13,
    left: ORB * 0.14,
    transform: [{ rotate: '-22deg' }],
  },
  hl2: {
    position: 'absolute',
    width:  ORB * 0.17,
    height: ORB * 0.09,
    borderRadius: ORB * 0.05,
    backgroundColor: 'rgba(255,255,255,0.70)',
    top:  ORB * 0.10,
    left: ORB * 0.17,
    transform: [{ rotate: '-22deg' }],
  },

  // Countdown
  orbContent: { alignItems: 'center', gap: 4 },
  countNum: {
    fontSize: 62,
    lineHeight: 68,
    fontFamily: fonts.display,
    letterSpacing: -1,
    color: 'rgba(255,245,228,0.92)',
  },
  phaseLabel: {
    fontSize: 10,
    fontFamily: fonts.bodyMedium,
    letterSpacing: 3.2,
    color: 'rgba(255,245,228,0.55)',
  },

  // ── Phase dots ──────────────────────────────────────────────────────────────
  phaseRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 10,
  },
  phaseItem: { alignItems: 'center', gap: 6 },
  dot:       { height: 7, borderRadius: 4 },
  dotLabel:  { fontSize: 10, fontFamily: fonts.bodyLight, letterSpacing: 0.4 },

  // ── Pattern ─────────────────────────────────────────────────────────────────
  pattern: {
    fontSize: 13,
    fontFamily: fonts.bodyLight,
    color: 'rgba(255,245,228,0.24)',
    textAlign: 'center',
    letterSpacing: 1.8,
    marginBottom: 24,
  },

  // ── Button ──────────────────────────────────────────────────────────────────
  btnWrap: {
    paddingHorizontal: 28,
    paddingBottom: 16,
  },
  btn: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#FF8000',
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.42,
    shadowRadius: 24,
    elevation: 7,
  },
  btnGrad: {
    paddingVertical: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontSize: 16,
    fontFamily: fonts.bodyMedium,
    letterSpacing: 0.3,
  },
});
