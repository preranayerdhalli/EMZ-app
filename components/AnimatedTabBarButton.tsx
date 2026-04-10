import { useRef, useCallback } from 'react';
import { Pressable, Animated } from 'react-native';

type AnimatedTabBarButtonProps = {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: object;
  [key: string]: unknown;
};

/**
 * Wraps a tab bar button with a subtle press animation: scale down + slight rise,
 * then spring back. Matches cursor rules (scale 0.97, 120ms, spring back).
 */
export function AnimatedTabBarButton({
  children,
  onPress,
  onLongPress,
  style,
  ...rest
}: AnimatedTabBarButtonProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const pressIn = useCallback(() => {
    Animated.parallel([
      Animated.timing(scaleAnim, { toValue: 0.97, duration: 120, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -3, duration: 120, useNativeDriver: true }),
    ]).start();
  }, [scaleAnim, translateY]);

  const pressOut = useCallback(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, stiffness: 280, damping: 28 }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, stiffness: 280, damping: 28 }),
    ]).start();
  }, [scaleAnim, translateY]);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      style={style}
      {...rest}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }, { translateY }] }}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
