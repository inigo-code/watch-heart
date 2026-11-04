import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSegments } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { ColorValue } from 'react-native';

import { Text } from '@/components/AppText';
import { EASE, Pop, useReducedMotion } from '@/components/Motion';
import { fonts, useTheme } from '@/lib/theme';
import type { Theme } from '@/lib/theme';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

/** A tab's icon, lit in the accent on the tab you're on. */
const tabIcon = (name: IconName) =>
  function TabBarIcon({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) {
    return (
      <Pop when={focused}>
        <MaterialCommunityIcons name={name} size={size} color={color as string} />
      </Pop>
    );
  };

/** A tab's name: one line, shrinking a little rather than losing letters ("WATCHLI…") on a narrow phone. */
function TabLabel({ color, children }: { color: ColorValue; children: string }) {
  return (
    <Text allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[styles.label, { color }]}>
      {children}
    </Text>
  );
}

const TABS = ['(home)', '(diary)', '(search)', '(watchlist)', '(recap)'];

/** A soft light on the bar's top edge, over the tab you're on: it glides across when you change tabs. */
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
      <Animated.View style={[styles.lightBar, { backgroundColor: theme.accent, boxShadow: `0 0 16px 3px ${theme.accent}`, transform: [{ scaleX: stretch }] }]} />
    </Animated.View>
  );
}

/** The bar's ground: a gradient from the page into black, with a faint line of the accent along its top edge. */
function TabBarBackground({ theme }: { theme: Theme }) {
  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient colors={theme.dark ? ['#17141C', '#060508'] : [theme.card, theme.bg]} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={[theme.accent + '00', theme.accent + '55', theme.accent + '00']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.line}
      />
      <TabLight theme={theme} />
    </View>
  );
}

export default function TabsLayout() {
  const theme = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.bg },
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: { backgroundColor: 'transparent', borderTopWidth: 0, elevation: 0 },
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
          title: 'HOME',
          tabBarIcon: tabIcon('home-variant-outline'),
        }}
      />
      <Tabs.Screen
        name="(diary)"
        options={{
          title: 'DIARY',
          tabBarIcon: tabIcon('ticket-confirmation-outline'),
        }}
      />
      <Tabs.Screen
        name="(search)"
        options={{
          title: 'FIND',
          tabBarIcon: tabIcon('movie-search-outline'),
        }}
      />
      <Tabs.Screen
        name="(watchlist)"
        options={{
          title: 'WATCHLIST',
          tabBarIcon: tabIcon('bookmark-multiple-outline'),
        }}
      />
      <Tabs.Screen
        name="(recap)"
        options={{
          title: 'RECAP',
          tabBarIcon: tabIcon('filmstrip'),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  // Sits in the space above the icon, so the icon doesn't move when the tab changes.
  line: { position: 'absolute', top: 0, left: 0, right: 0, height: 1.5 },
  light: { position: 'absolute', top: 0, left: 0, height: 2, alignItems: 'center' },
  lightBar: { width: 36, height: 2, borderRadius: 1 },
  // Five tabs: small and tight enough that WATCHLIST fits on a narrow phone.
  label: { fontFamily: fonts.monoBold, fontSize: 10, letterSpacing: 0, textAlign: 'center', alignSelf: 'stretch' },
});
