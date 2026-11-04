import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { Tabs } from 'expo-router/js-tabs';
import { StyleSheet, View } from 'react-native';
import type { ColorValue } from 'react-native';

import { Text } from '@/components/AppText';
import { Pop } from '@/components/Motion';
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

/** The bar's ground: a gradient from the page into black, with a line of the accent along its top edge. */
function TabBarBackground({ theme }: { theme: Theme }) {
  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient colors={theme.dark ? ['#17141C', '#060508'] : [theme.card, theme.bg]} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={[theme.accent + '00', theme.accent, theme.accent + '00']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.line}
      />
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
  // Five tabs: small and tight enough that WATCHLIST fits on a narrow phone.
  label: { fontFamily: fonts.monoBold, fontSize: 10, letterSpacing: 0, textAlign: 'center', alignSelf: 'stretch' },
});
