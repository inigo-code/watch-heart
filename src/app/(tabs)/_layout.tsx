import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs } from 'expo-router/js-tabs';

import { fonts, useTheme } from '@/lib/theme';

export default function TabsLayout() {
  const theme = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.bg },
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: { backgroundColor: theme.dark ? '#000000' : theme.card, borderTopColor: theme.border },
        tabBarLabelStyle: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 1 },
        // Switching tabs slides the new one in slightly, so the change reads as movement, not a flash.
        animation: 'shift',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'DIARY',
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="ticket-confirmation-outline" size={size} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'FIND',
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="movie-search-outline" size={size} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="watchlist"
        options={{
          title: 'WATCHLIST',
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="bookmark-multiple-outline" size={size} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="recap"
        options={{
          title: 'RECAP',
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="filmstrip" size={size} color={color as string} />,
        }}
      />
    </Tabs>
  );
}
