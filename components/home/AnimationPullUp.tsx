import { useRef, useEffect } from 'react';
import {
  Image,
  StyleSheet,
  Animated,
  Pressable,
  useWindowDimensions,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BEE_SIZE = 120;
const COLLAPSED_HEIGHT = 72;
const COLLAPSED_WIDTH = BEE_SIZE;
const TAB_BAR_CONTENT_HEIGHT = 64;
const TAB_BAR_HORIZONTAL_INSET = 20;

type AnimationPullUpProps = {
  onPress?: () => void;
};

export function AnimationPullUp({ onPress }: AnimationPullUpProps) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const beeBob = useRef(new Animated.Value(0)).current;

  const bottomOffset = TAB_BAR_CONTENT_HEIGHT + insets.bottom;
  const tabBarContentWidth = windowWidth - TAB_BAR_HORIZONTAL_INSET * 2;
  const collapsedLeft = TAB_BAR_HORIZONTAL_INSET + (tabBarContentWidth - COLLAPSED_WIDTH) / 2;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(beeBob, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
        Animated.timing(beeBob, {
          toValue: 0,
          duration: 1800,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [beeBob]);

  const beeTranslateY = beeBob.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -12],
  });

  return (
    <Animated.View
      style={[
        styles.sheet,
        {
          left: collapsedLeft,
          bottom: bottomOffset,
          width: COLLAPSED_WIDTH,
          height: COLLAPSED_HEIGHT,
        },
      ]}
    >
      <Pressable
        style={styles.touch}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Open"
      >
        <Animated.View style={{ transform: [{ translateY: beeTranslateY }] }}>
          <Image
            source={require('@/assets/images/bee.png')}
            style={styles.bee}
            resizeMode="contain"
            accessibilityLabel="Bee"
          />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    overflow: 'visible',
    alignItems: 'center',
  },
  touch: {
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  bee: {
    width: BEE_SIZE,
    height: BEE_SIZE,
  },
});
