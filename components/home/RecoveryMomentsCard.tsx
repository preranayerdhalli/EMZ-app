import { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  UIManager,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Card } from '@/components/ui';
import { palette, colors, borderRadius, typography, fonts } from '@/constants/theme';
import { fmtTimeCompact } from '@/utils/time';
import {
  MUSIC_SUGGESTIONS,
  BREATHING_SUGGESTIONS,
  type MusicSuggestion,
  type BreathingSuggestion,
} from '@/constants/recoveryLibrary';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ACCENT = palette.accentOrange;
const TEXT_PRIMARY = colors.ink.primary;
const TEXT_SECONDARY = colors.ink.secondary;
const TEXT_TERTIARY = colors.ink.tertiary;

// ─── Brand-colour thumbnail gradients ────────────────────────────────────────

const MUSIC_GRADIENTS: [string, string][] = [
  [palette.accentOrange,      palette.accentYellow],
  [palette.accentYellow,      palette.accentOrangeLight],
  [palette.accentOrangeLight, palette.accentOrange],
  ['#E86A00',                 palette.accentYellow],
  [palette.accentOrange,      palette.backgroundSecondary],
  [palette.accentYellow,      palette.accentOrange],
];

// ─── Music row ────────────────────────────────────────────────────────────────

type MusicRowProps = {
  music: MusicSuggestion;
  gradientIdx: number;
  suggestedTime?: string;
  onPress: () => void;
};

function MusicRow({ music, gradientIdx, suggestedTime, onPress }: MusicRowProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const gradient = MUSIC_GRADIENTS[gradientIdx % MUSIC_GRADIENTS.length];

  const pressIn = () =>
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, tension: 200, friction: 8 }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 200, friction: 8 }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable style={styles.row} onPress={onPress} onPressIn={pressIn} onPressOut={pressOut}>
        <View style={styles.thumb}>
          <Image source={require('../../assets/images/Music Icon.jpg')} style={StyleSheet.absoluteFill} />
        </View>

        <View style={styles.rowInfo}>
          <Text style={styles.rowTitle} numberOfLines={1}>{music.title}</Text>
          <Text style={styles.rowMood} numberOfLines={1}>{music.mood}</Text>
          <Text style={styles.rowMeta} numberOfLines={1}>
            {music.durationMin} min{suggestedTime ? ` · ${suggestedTime}` : ''}
          </Text>
        </View>

        <LinearGradient colors={[palette.accentYellow, palette.accentOrangeLight]} style={styles.playBtn}>
          <Ionicons name="play" size={13} color={palette.textPrimary} style={{ marginLeft: 2 }} />
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

// ─── Breathing row ────────────────────────────────────────────────────────────

type BreathingRowProps = {
  breath: BreathingSuggestion;
  suggestedTime?: string;
  onPress: () => void;
};

function BreathingRow({ breath, suggestedTime, onPress }: BreathingRowProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () =>
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, tension: 200, friction: 8 }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 200, friction: 8 }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable style={styles.row} onPress={onPress} onPressIn={pressIn} onPressOut={pressOut}>
        <View style={styles.thumb}>
          <Image source={require('../../assets/images/Music Icon.jpg')} style={StyleSheet.absoluteFill} />
        </View>

        <View style={styles.rowInfo}>
          <Text style={styles.rowTitle} numberOfLines={1}>Box Breathing</Text>
          <Text style={styles.rowMood} numberOfLines={1}>{breath.pattern}</Text>
          <Text style={styles.rowIntent} numberOfLines={1}>{breath.intent}</Text>
          <Text style={styles.rowMeta} numberOfLines={1}>
            {breath.durationMin} min{suggestedTime ? ` · ${suggestedTime}` : ''}
          </Text>
        </View>

        <LinearGradient colors={[palette.accentYellow, palette.accentOrangeLight]} style={styles.playBtn}>
          <Ionicons name="play" size={13} color={palette.textPrimary} style={{ marginLeft: 2 }} />
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

type RecoveryMomentsCardProps = {
  rechargeSlots?: number[];
};

export function RecoveryMomentsCard({ rechargeSlots = [] }: RecoveryMomentsCardProps) {
  const [idx, setIdx] = useState(0);
  const [open, setOpen] = useState(true);

  const music = MUSIC_SUGGESTIONS[idx % MUSIC_SUGGESTIONS.length];
  const breath = BREATHING_SUGGESTIONS[idx % BREATHING_SUGGESTIONS.length];

  const shuffleAnim = useRef(new Animated.Value(0)).current;
  const chevronAnim = useRef(new Animated.Value(1)).current;

  const shuffle = useCallback(() => {
    shuffleAnim.setValue(0);
    Animated.timing(shuffleAnim, {
      toValue: 1,
      duration: 380,
      easing: Easing.out(Easing.back(1.2)),
      useNativeDriver: true,
    }).start();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIdx(i => (i + 1) % Math.max(MUSIC_SUGGESTIONS.length, BREATHING_SUGGESTIONS.length));
  }, [shuffleAnim]);

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Animated.spring(chevronAnim, {
      toValue: next ? 1 : 0,
      useNativeDriver: true,
      tension: 120,
      friction: 12,
    }).start();
  };

  const shuffleScale = shuffleAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.2, 1] });
  const chevronDeg = chevronAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });

  const handleMusicPress = useCallback(() => {
    router.push({
      pathname: '/music-player',
      params: { title: music.title, mood: music.mood, gradientIdx: String(idx) },
    });
  }, [music, idx]);

  const handleBreathPress = useCallback(() => {
    router.push({
      pathname: '/box-breathing',
      params: { intent: breath.intent, pattern: breath.pattern },
    });
  }, [breath]);

  return (
    <Card variant="card" inset={false} style={styles.wrap}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable style={styles.headerLeft} onPress={toggleOpen}>
          <Ionicons name="heart" size={15} color={ACCENT} />
          <Text style={styles.headerLabel}>Recharge Windows</Text>
          <Animated.View style={{ transform: [{ rotate: chevronDeg }] }}>
            <Ionicons name="chevron-down" size={15} color={TEXT_TERTIARY} />
          </Animated.View>
        </Pressable>

        <Pressable onPress={shuffle} hitSlop={14} style={styles.shuffleBtn}>
          <Animated.View style={{ transform: [{ scale: shuffleScale }] }}>
            <Ionicons name="shuffle" size={18} color={TEXT_SECONDARY} />
          </Animated.View>
        </Pressable>
      </View>

      {/* ── Rows ── */}
      {open && (
        <View style={styles.body}>
          <View style={styles.topDivider} />
          <MusicRow
            music={music}
            gradientIdx={idx}
            suggestedTime={rechargeSlots[0] !== undefined ? fmtTimeCompact(rechargeSlots[0]) : undefined}
            onPress={handleMusicPress}
          />
          <View style={styles.innerDivider} />
          <BreathingRow
            breath={breath}
            suggestedTime={rechargeSlots[1] !== undefined ? fmtTimeCompact(rechargeSlots[1]) : rechargeSlots[0] !== undefined ? fmtTimeCompact(rechargeSlots[0] + music.durationMin) : undefined}
            onPress={handleBreathPress}
          />
        </View>
      )}
    </Card>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrap: {
    borderRadius: borderRadius.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerLabel: {
    flex: 1,
    fontSize: typography.cardTitle.fontSize,
    lineHeight: typography.cardTitle.lineHeight,
    fontFamily: fonts.bodyMedium,
    color: TEXT_PRIMARY,
  },
  shuffleBtn: {
    marginLeft: 8,
  },

  body: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  topDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider.subtle,
  },
  innerDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider.subtle,
    marginLeft: 76,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 14,
  },

  thumb: {
    width: 52,
    height: 52,
    borderRadius: 8,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },

  rowInfo: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: fonts.bodyMedium,
    color: TEXT_PRIMARY,
  },
  rowMood: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.bodyLight,
    color: TEXT_SECONDARY,
  },
  rowIntent: {
    fontSize: 11,
    lineHeight: 15,
    fontFamily: fonts.bodyLight,
    color: TEXT_TERTIARY,
    marginTop: 1,
  },
  rowMeta: {
    fontSize: 11,
    lineHeight: 15,
    fontFamily: fonts.bodyLight,
    color: ACCENT,
    marginTop: 2,
  },

  playBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
