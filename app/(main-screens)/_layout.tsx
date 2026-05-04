import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, AppState, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { AppBackground } from '@/components/AuthBackground';
import { AnimatedTabBarButton } from '@/components/AnimatedTabBarButton';
import { ChatProvider } from '@/context/ChatContext';
import { palette, colors, spacing, borderRadius, fonts, cardShadow } from '@/constants/theme';
import { syncAppleCalendar } from '@/services/calendar';

const TAB_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: 'home',
  calendar: 'calendar',
};

function TabBarIcon({ name, focused }: { name: string; focused: boolean }) {
  const iconName = TAB_ICONS[name] ?? 'help';
  const color = focused ? palette.accentOrange : colors.ink.tertiary;
  return <Ionicons name={iconName} size={22} color={color} />;
}

function TabBarLabel({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text
      style={[styles.tabLabel, focused && styles.tabLabelActive]}
      numberOfLines={1}
    >
      {label}
    </Text>
  );
}

export default function MainScreensLayout() {
  const insets = useSafeAreaInsets();
  const appState = useRef(AppState.currentState);

  // Sync Apple calendar on foreground (iOS only).
  // Health sync is handled by backgroundSync.ts via subscribeToForegroundSync().
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    syncAppleCalendar().catch(() => {});

    const sub = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        syncAppleCalendar().catch(() => {});
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, []);

  const headerBarHeight = 44;
  const tabBarContentHeight = 64;

  return (
    <ChatProvider>
      <AppBackground>
        <Tabs
        screenOptions={{
          headerShown: true,
          sceneContainerStyle: { backgroundColor: 'transparent' },
          sceneStyle: { backgroundColor: 'transparent' },
          headerStyle: {
            backgroundColor: 'transparent',
            elevation: 0,
            shadowOpacity: 0,
            height: insets.top + headerBarHeight,
          },
          headerBackground: () => (
            <View style={styles.headerBg}>
              <LinearGradient
                colors={[palette.background, palette.backgroundSecondary]}
                start={{ x: 0.15, y: 0 }}
                end={{ x: 0.85, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.headerBottomBorder} />
            </View>
          ),
          headerTitleAlign: 'left',
          headerTintColor: colors.ink.primary,
          headerTitleStyle: {
            fontSize: 17,
            fontFamily: fonts.display,
          },
          tabBarStyle: {
            position: 'absolute',
            bottom: 0,
            left: 16,
            right: 16,
            height: tabBarContentHeight + insets.bottom,
            paddingBottom: insets.bottom,
            backgroundColor: 'transparent',
            borderTopWidth: 0,
            elevation: 0,
            shadowOpacity: 0,
          },
          tabBarBackground: () => (
            <View style={styles.tabBarOuter}>
              <LinearGradient
                colors={[palette.background, palette.backgroundSecondary]}
                start={{ x: 0.15, y: 0 }}
                end={{ x: 0.85, y: 1 }}
                style={[StyleSheet.absoluteFill, { borderRadius: borderRadius.tabBar }]}
              />
              <View style={styles.tabBarBorder} />
            </View>
          ),
          tabBarActiveTintColor: palette.accentOrange,
          tabBarInactiveTintColor: colors.ink.tertiary,
          tabBarShowLabel: true,
          tabBarLabelStyle: styles.tabLabelBase,
          tabBarItemStyle: { paddingTop: 8 },
          tabBarIcon: ({ focused, name }) => {
            const route = name as string;
            return <TabBarIcon name={route} focused={focused} />;
          },
          tabBarButton: (props) => <AnimatedTabBarButton {...props} />,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            headerShown: false,
            tabBarLabel: 'Home',
            tabBarIcon: ({ focused }) => <TabBarIcon name="index" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="calendar"
          options={{
            title: 'Calendar',
            tabBarLabel: 'Calendar',
            tabBarIcon: ({ focused }) => <TabBarIcon name="calendar" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{ href: null }}
        />
      </Tabs>
      </AppBackground>
    </ChatProvider>
  );
}

const styles = StyleSheet.create({
  headerBg: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  headerBottomBorder: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 1,
    backgroundColor: colors.divider.hairline,
  },
  tabBarOuter: {
    flex: 1,
    borderRadius: borderRadius.tabBar,
    overflow: 'hidden',
    ...cardShadow,
  },
  tabBarBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: borderRadius.tabBar,
    borderWidth: 1,
    borderColor: colors.divider.strong,
  },
  tabLabelBase: {
    fontSize: 11,
    fontFamily: fonts.bodyRegular,
  },
  tabLabel: {
    fontSize: 11,
    fontFamily: fonts.bodyRegular,
    color: colors.ink.tertiary,
  },
  tabLabelActive: {
    color: palette.accentOrange,
    fontFamily: fonts.bodyMedium,
  },
});
