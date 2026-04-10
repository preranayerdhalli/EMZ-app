import { useEffect, useRef } from 'react';
import { Pressable, Text, StyleSheet, View, Animated, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { palette, colors, borderRadius, layout, fonts } from '@/constants/theme';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
  left?: React.ReactNode;
  style?: ViewStyle;
};

export function Button({
  label,
  onPress,
  disabled,
  variant = 'primary',
  left,
  style,
}: Props) {
  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary';
  const sheen = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isPrimary) return;
    // Subtle one-time sheen sweep
    Animated.sequence([
      Animated.delay(220),
      Animated.timing(sheen, { toValue: 1, duration: 520, useNativeDriver: true }),
    ]).start();
  }, [isPrimary, sheen]);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.base,
        isSecondary && styles.secondary,
        variant === 'ghost' && styles.ghost,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {isPrimary ? (
        <>
          {/* Warm gold → orange gradient (135deg approx) */}
          <LinearGradient
            colors={[palette.accentYellow, palette.accentOrangeLight]}
            start={{ x: 0.15, y: 0 }}
            end={{ x: 0.85, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.sheenWrap,
              {
                opacity: sheen.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.85, 0] }),
                transform: [
                  {
                    translateX: sheen.interpolate({ inputRange: [0, 1], outputRange: [-140, 180] }),
                  },
                ],
              },
            ]}
          >
            <LinearGradient
              colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.45)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.sheen}
            />
          </Animated.View>
        </>
      ) : null}

      <View style={styles.inner}>
        {left ? <View style={styles.left}>{left}</View> : null}
        <Text style={[styles.text, isPrimary ? styles.textPrimary : styles.textSecondary]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: layout.tapMin,
    height: 52,
    borderRadius: borderRadius.button,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 182, 108, 0.30)',
    backgroundColor: palette.accentYellow,
  },
  secondary: {
    backgroundColor: 'rgba(244, 239, 207, 0.90)',
    borderColor: 'rgba(46, 46, 46, 0.14)',
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 18,
  },
  left: { alignItems: 'center', justifyContent: 'center' },
  pressed: { transform: [{ scale: 0.985 }], opacity: 0.94 },
  disabled: { opacity: 0.5 },
  text: {
    fontSize: 16,
    fontFamily: fonts.bodyMedium,
    letterSpacing: -0.1,
  },
  textPrimary: { color: palette.textPrimary },
  textSecondary: { color: colors.ink.primary },
  sheenWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  sheen: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    width: 80,
    transform: [{ rotate: '18deg' }],
  },
});
