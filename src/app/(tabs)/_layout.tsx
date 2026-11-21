import { useSegments } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/AppText';
import { CineIcon } from '@/components/CineIcon';
import type { CineIconName } from '@/components/CineIcon';
import { EASE, Pop, useReducedMotion } from '@/components/Motion';
import { fonts, useTheme } from '@/lib/theme';
import type { Theme } from '@/lib/theme';

/** A tab's icon, from the app's own set: filled and lit in the accent on the tab you're on. */
const tabIcon = (name: CineIconName) =>
  function TabBarIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return (
      <Pop when={focused}>
        <CineIcon name={name} size={26} color={color as string} on={focused} />
      </Pop>
    );
  };

/** A tab's name: one line, shrinking a little rather than losing letters ("Watchli…") on a narrow phone. */
function TabLabel({ color, children }: { color: ColorValue; children: string }) {
  return (
    <Text allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[styles.label, { color }]}>
      {children}
    </Text>
  );
}

const TABS = ['(home)', '(diary)', '(search)', '(watchlist)', '(recap)'];

/** A short line on the bar's top edge, over the tab you're on: it glides across when you change tabs. */
function TabLight({ theme }: { theme: Theme }) {
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const segments = useSegments() as string[];
  const index = Math.max(0, TABS.indexOf(segments[1] ?? ''));
  const each = width / TABS.length;
  const [at] = useState(() => new Animated.Value(index * each));
  const [stretch] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (reduced) {
      at.setValue(index * each);
      return;
    }
    Animated.parallel([
      Animated.timing(at, { toValue: index * each, duration: 460, easing: EASE, useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(stretch, { toValue: 1.7, duration: 140, easing: EASE, useNativeDriver: true }),
        Animated.timing(stretch, { toValue: 1, duration: 320, easing: EASE, useNativeDriver: true }),
      ]),
    ]).start();
  }, [at, stretch, index, each, reduced]);
  return (
    <Animated.View pointerEvents="none" style={[styles.light, { width: each, transform: [{ translateX: at }] }]}>
      <Animated.View style={[styles.lightBar, { backgroundColor: theme.accent, transform: [{ scaleX: stretch }] }]} />
    </Animated.View>
  );
}

/** The bar's ground: the page colour, a step darker, with a hairline along its top edge. */
function TabBarBackground({ theme }: { theme: Theme }) {
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.dark ? '#08070A' : theme.card, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
      <TabLight theme={theme} />
    </View>
  );
}

export default function TabsLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.bg },
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textMuted,
        // Tall enough for the icon and a whole line of label, descenders included.
        tabBarStyle: { backgroundColor: 'transparent', borderTopWidth: 0, elevation: 0, height: 58 + insets.bottom, paddingTop: 4 },
        tabBarBackground: () => <TabBarBackground theme={theme} />,
        tabBarLabel: TabLabel,
        tabBarItemStyle: { paddingHorizontal: 0 },
        // Switching tabs slides the new one in slightly, so the change reads as movement, not a flash.
        animation: 'shift',
      }}
    >
      <Tabs.Screen
        name="(home)"
        options={{
          title: 'Home',
          tabBarIcon: tabIcon('home'),
        }}
      />
      <Tabs.Screen
        name="(diary)"
        options={{
          title: 'Diary',
          tabBarIcon: tabIcon('diary'),
        }}
      />
      <Tabs.Screen
        name="(search)"
        options={{
          title: 'Find',
          tabBarIcon: tabIcon('find'),
        }}
      />
      <Tabs.Screen
        name="(watchlist)"
        options={{
          title: 'Watchlist',
          tabBarIcon: tabIcon('watchlist'),
        }}
      />
      <Tabs.Screen
        name="(recap)"
        options={{
          title: 'Recap',
          tabBarIcon: tabIcon('recap'),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  light: { position: 'absolute', top: 0, left: 0, height: 2, alignItems: 'center' },
  lightBar: { width: 36, height: 2, borderRadius: 1 },
  // Five tabs: small enough that Watchlist fits on a narrow phone.
  label: { fontFamily: fonts.uiMedium, fontSize: 11, lineHeight: 15, flexShrink: 0, textAlign: 'center', alignSelf: 'stretch' },
});
