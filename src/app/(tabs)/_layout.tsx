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
        // Five tabs: small and tight enough that WATCHLIST fits on a narrow phone.
        tabBarLabelStyle: { fontFamily: fonts.monoBold, fontSize: 10, letterSpacing: 0.4 },
        // Switching tabs slides the new one in slightly, so the change reads as movement, not a flash.
        animation: 'shift',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'HOME',
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="home-variant-outline" size={size} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="diary"
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
