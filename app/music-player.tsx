import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  SafeAreaView,
  StatusBar,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { AppBackground } from '@/components/AuthBackground';
import { palette, colors, typography, fonts, borderRadius } from '@/constants/theme';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TOTAL_DURATION = 210; // fake 3:30

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

const MUSIC_ICON = require('../assets/images/Music Icon.jpg');

// ─── Equalizer bars ───────────────────────────────────────────────────────────

function EqualizerBars({ playing }: { playing: boolean }) {
  const bars = [
    useRef(new Animated.Value(8)).current,
    useRef(new Animated.Value(16)).current,
    useRef(new Animated.Value(10)).current,
    useRef(new Animated.Value(20)).current,
    useRef(new Animated.Value(12)).current,
  ];

  const anim = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (playing) {
      const makeLoop = (bar: Animated.Value, hi: number, lo: number, dur: number) =>
        Animated.loop(
          Animated.sequence([
            Animated.timing(bar, { toValue: hi, duration: dur, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
            Animated.timing(bar, { toValue: lo, duration: dur, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
          ])
        );

      anim.current = Animated.parallel([
        makeLoop(bars[0], 22, 6, 380),
        makeLoop(bars[1], 28, 8, 290),
        makeLoop(bars[2], 18, 5, 420),
        makeLoop(bars[3], 30, 10, 340),
        makeLoop(bars[4], 20, 7, 310),
      ]);
      anim.current.start();
    } else {
      anim.current?.stop();
      bars.forEach((b, i) => {
        Animated.spring(b, { toValue: [8, 16, 10, 20, 12][i], useNativeDriver: false }).start();
      });
    }
    return () => anim.current?.stop();
  }, [playing]);

  return (
    <View style={eq.wrap}>
      {bars.map((bar, i) => (
        <Animated.View key={i} style={[eq.bar, { height: bar }]} />
      ))}
    </View>
  );
}

const eq = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: 32,
    marginTop: 20,
  },
  bar: {
    width: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MusicPlayerScreen() {
  const params = useLocalSearchParams<{
    title?: string;
    mood?: string;
    gradientIdx?: string;
  }>();

  const title = params.title ?? 'Lo-fi Chill Beats';
  const mood = params.mood ?? 'Focus · Calm';

  const [playing, setPlaying] = useState(false);
  const [currentSec, setCurrentSec] = useState(0);
  const [liked, setLiked] = useState(false);
  const [shuffled, setShuffled] = useState(false);
  const [trackWidth, setTrackWidth] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const artScale = useRef(new Animated.Value(1)).current;
  const artPulseAnim = useRef<Animated.CompositeAnimation | null>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Smooth scrubber
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: currentSec / TOTAL_DURATION,
      duration: 960,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
  }, [currentSec]);

  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(() => {
        setCurrentSec(s => {
          if (s >= TOTAL_DURATION) { setPlaying(false); return 0; }
          return s + 1;
        });
      }, 1000);

      artPulseAnim.current = Animated.loop(
        Animated.sequence([
          Animated.timing(artScale, { toValue: 1.015, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(artScale, { toValue: 1.0, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
      artPulseAnim.current.start();
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      artPulseAnim.current?.stop();
      Animated.spring(artScale, { toValue: 1, useNativeDriver: true, tension: 180, friction: 10 }).start();
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing]);

  const handleScrubberPress = useCallback((evt: any) => {
    if (trackWidth === 0) return;
    const x = evt.nativeEvent.locationX;
    const fraction = Math.min(1, Math.max(0, x / trackWidth));
    const newSec = Math.floor(fraction * TOTAL_DURATION);
    setCurrentSec(newSec);
    progressAnim.setValue(fraction);
  }, [trackWidth]);

  const scrubberFillWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, trackWidth],
    extrapolate: 'clamp',
  });
  const thumbPosition = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-7, trackWidth - 7],
    extrapolate: 'clamp',
  });

  return (
    <AppBackground>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safe}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={14} style={styles.headerSide}>
            <Ionicons name="chevron-down" size={28} color={colors.ink.primary} />
          </Pressable>
          <Text style={styles.headerTitle}>NOW PLAYING</Text>
          <Pressable hitSlop={14} style={styles.headerSide}>
            <Ionicons name="ellipsis-horizontal" size={22} color={colors.ink.primary} />
          </Pressable>
        </View>

        {/* ── Album art ── */}
        <View style={styles.artOuter}>
          <Animated.View style={[styles.artWrap, { transform: [{ scale: artScale }] }]}>
            <Image source={MUSIC_ICON} style={styles.artImage} resizeMode="cover" />
            <View style={styles.artOverlay}>
              <EqualizerBars playing={playing} />
            </View>
          </Animated.View>
        </View>

        {/* ── Track info ── */}
        <View style={styles.infoRow}>
          <View style={styles.infoText}>
            <Text style={styles.trackTitle} numberOfLines={1}>{title}</Text>
            <Text style={styles.trackMood}>{mood}</Text>
          </View>
          <Pressable onPress={() => setLiked(l => !l)} hitSlop={14}>
            <Ionicons
              name={liked ? 'heart' : 'heart-outline'}
              size={26}
              color={liked ? palette.accentOrange : colors.ink.tertiary}
            />
          </Pressable>
        </View>

        {/* ── Scrubber ── */}
        <View style={styles.scrubberSection}>
          <Pressable
            onPress={handleScrubberPress}
            onLayout={e => setTrackWidth(e.nativeEvent.layout.width)}
            style={styles.scrubberTrack}
          >
            <Animated.View style={[styles.scrubberFill, { width: scrubberFillWidth }]} />
            <Animated.View style={[styles.scrubberThumb, { left: thumbPosition }]} />
          </Pressable>
          <View style={styles.timeRow}>
            <Text style={styles.timeLabel}>{fmtTime(currentSec)}</Text>
            <Text style={styles.timeLabel}>{fmtTime(TOTAL_DURATION)}</Text>
          </View>
        </View>

        {/* ── Controls ── */}
        <View style={styles.controls}>
          <Pressable
            style={styles.ctrlSm}
            onPress={() => setShuffled(s => !s)}
            hitSlop={12}
          >
            <Ionicons
              name="shuffle"
              size={22}
              color={shuffled ? palette.accentOrange : colors.ink.tertiary}
            />
          </Pressable>

          <Pressable
            style={styles.ctrlSm}
            onPress={() => setCurrentSec(s => Math.max(0, s - 15))}
            hitSlop={12}
          >
            <Ionicons name="play-skip-back" size={30} color={colors.ink.primary} />
          </Pressable>

          <Pressable style={styles.playBtn} onPress={() => setPlaying(p => !p)}>
            <Ionicons
              name={playing ? 'pause' : 'play'}
              size={30}
              color={palette.background}
              style={playing ? undefined : { marginLeft: 3 }}
            />
          </Pressable>

          <Pressable
            style={styles.ctrlSm}
            onPress={() => setCurrentSec(s => Math.min(TOTAL_DURATION, s + 15))}
            hitSlop={12}
          >
            <Ionicons name="play-skip-forward" size={30} color={colors.ink.primary} />
          </Pressable>

          <Pressable style={styles.ctrlSm} hitSlop={12}>
            <Ionicons name="repeat" size={22} color={colors.ink.tertiary} />
          </Pressable>
        </View>

        {/* ── Description ── */}
        <View style={styles.descriptionSection}>
          <Text style={styles.descriptionText}>
            Carefully curated lo-fi beats designed to help you focus, unwind, and stay in the zone — perfect for study sessions, work, or quiet evenings.
          </Text>
        </View>

      </SafeAreaView>
    </AppBackground>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  headerSide: {
    width: 44,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: typography.micro.fontSize,
    fontFamily: fonts.bodyMedium,
    color: colors.ink.secondary,
    letterSpacing: 1.6,
  },

  artOuter: {
    paddingHorizontal: 32,
    paddingBottom: 28,
  },
  artWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#2E2E2E',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 10,
  },
  artImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  artOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 16,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 28,
    marginBottom: 22,
    gap: 12,
  },
  infoText: { flex: 1 },
  trackTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontFamily: fonts.display,
    color: colors.ink.primary,
    letterSpacing: -0.3,
  },
  trackMood: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.bodyLight,
    color: colors.ink.secondary,
    marginTop: 3,
  },

  scrubberSection: {
    paddingHorizontal: 28,
    marginBottom: 32,
  },
  scrubberTrack: {
    height: 4,
    backgroundColor: colors.divider.strong,
    borderRadius: 2,
    marginBottom: 10,
    position: 'relative',
  },
  scrubberFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: palette.accentYellow,
    borderRadius: 2,
  },
  scrubberThumb: {
    position: 'absolute',
    top: -5,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: palette.accentOrange,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeLabel: {
    fontSize: 12,
    fontFamily: fonts.bodyLight,
    color: colors.ink.tertiary,
  },

  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  ctrlSm: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: palette.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2E2E2E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 6,
  },

  descriptionSection: {
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 8,
  },
  descriptionText: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: fonts.bodyLight,
    color: colors.ink.secondary,
    textAlign: 'center',
  },
});
