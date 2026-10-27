import { BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue/400Regular';
import { CourierPrime_400Regular } from '@expo-google-fonts/courier-prime/400Regular';
import { CourierPrime_700Bold } from '@expo-google-fonts/courier-prime/700Bold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { ToastProvider } from '@/components/Toast';
import { UpdatePrompt } from '@/components/UpdatePrompt';
import { fonts, useTheme } from '@/lib/theme';
import { AppLockProvider } from '@/lock/AppLockProvider';
import { SettingsProvider } from '@/settings/SettingsProvider';
import { DiaryStoreProvider } from '@/store/DiaryStore';

// Keep the splash up until the marquee and typewriter fonts are ready, so titles never flash in the fallback.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ BebasNeue_400Regular, CourierPrime_400Regular, CourierPrime_700Bold });
  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  return (
    <SettingsProvider>
      <DiaryStoreProvider>
        <ToastProvider>
          <AppLockProvider>
            <Navigator />
          </AppLockProvider>
        </ToastProvider>
      </DiaryStoreProvider>
    </SettingsProvider>
  );
}

function Navigator() {
  const theme = useTheme();
  return (
    <>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <UpdatePrompt />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.bg },
          headerTintColor: theme.text,
          headerTitleStyle: { fontFamily: fonts.display, fontSize: 24 },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="log" options={{ title: '', presentation: 'modal' }} />
        <Stack.Screen name="entry/[id]" options={{ title: '', headerTransparent: true }} />
        <Stack.Screen name="card/[id]" options={{ title: 'STORY CARD' }} />
        <Stack.Screen name="settings" options={{ title: 'SETTINGS' }} />
        <Stack.Screen name="trash" options={{ title: 'TRASH' }} />
        <Stack.Screen name="about" options={{ title: 'ABOUT' }} />
      </Stack>
    </>
  );
}
