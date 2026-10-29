import { BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue/400Regular';
import { CourierPrime_400Regular } from '@expo-google-fonts/courier-prime/400Regular';
import { CourierPrime_700Bold } from '@expo-google-fonts/courier-prime/700Bold';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useFonts } from 'expo-font';
import { Stack, router, usePathname } from 'expo-router';
import { ShareIntentProvider, useShareIntentContext } from 'expo-share-intent';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { ToastProvider } from '@/components/Toast';
import { UpdatePrompt } from '@/components/UpdatePrompt';
import { fonts, useTheme } from '@/lib/theme';
import { useTmdbFreshness } from '@/lib/tmdbFreshness';
import { AppLockProvider } from '@/lock/AppLockProvider';
import { FriendsProvider } from '@/friends/FriendsProvider';
import { ListsProvider } from '@/lists/ListsProvider';
import { SettingsProvider } from '@/settings/SettingsProvider';
import { DiaryStoreProvider } from '@/store/DiaryStore';
import { SyncProvider } from '@/sync/SyncProvider';
import { WidgetSync } from '@/widget/WidgetSync';

// Keep the splash up until the marquee and typewriter fonts are ready, so titles never flash in the fallback.
SplashScreen.preventAutoHideAsync().catch(() => {});

// Receiving shares needs the native module, which web and Expo Go don't have.
const shareDisabled = Platform.OS === 'web' || Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ BebasNeue_400Regular, CourierPrime_400Regular, CourierPrime_700Bold });
  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  // Draw nothing (the splash stays up) until the fonts are in. Android measures text once, so text
  // laid out in the fallback font keeps the wrong width: a gap in the title, cut-off tab labels.
  if (!fontsLoaded && !fontError) return null;

  return (
    <ShareIntentProvider options={{ disabled: shareDisabled, resetOnBackground: true }}>
    <SettingsProvider>
      <DiaryStoreProvider>
        <ListsProvider>
        <SyncProvider>
        <FriendsProvider>
          <ToastProvider>
            <AppLockProvider>
              <Navigator />
              <WidgetSync />
            </AppLockProvider>
          </ToastProvider>
        </FriendsProvider>
        </SyncProvider>
        </ListsProvider>
      </DiaryStoreProvider>
    </SettingsProvider>
    </ShareIntentProvider>
  );
}

function Navigator() {
  const theme = useTheme();
  const pathname = usePathname();
  const { hasShareIntent } = useShareIntentContext();
  useTmdbFreshness();

  // On Android, a shared link arrives through the native module rather than a deep link,
  // so open the Share screen whenever something has been shared and not yet handled.
  useEffect(() => {
    if (hasShareIntent && pathname !== '/share') router.push('/share');
  }, [hasShareIntent, pathname]);

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
        <Stack.Screen name="account" options={{ title: 'ACCOUNT & SYNC' }} />
        <Stack.Screen name="trash" options={{ title: 'TRASH' }} />
        <Stack.Screen name="import" options={{ title: 'IMPORT' }} />
        <Stack.Screen name="about" options={{ title: 'ABOUT' }} />
        <Stack.Screen name="profile" options={{ title: 'PROFILE' }} />
        <Stack.Screen name="track" options={{ title: 'EPISODES' }} />
        <Stack.Screen name="lists" options={{ title: 'YOUR LISTS' }} />
        <Stack.Screen name="list/[id]" options={{ title: 'LIST' }} />
        <Stack.Screen name="list-card/[id]" options={{ title: 'LIST STORY' }} />
        <Stack.Screen name="profile-card" options={{ title: 'PROFILE CARD' }} />
        <Stack.Screen name="share" options={{ title: '' }} />
        <Stack.Screen name="title/[id]" options={{ title: '', headerTransparent: true }} />
        <Stack.Screen name="credits/[id]" options={{ title: 'CAST & CREW' }} />
        <Stack.Screen name="person/[id]" options={{ title: '' }} />
        <Stack.Screen name="browse" options={{ title: 'DISCOVER' }} />
        <Stack.Screen name="friends" options={{ title: 'FRIENDS' }} />
        <Stack.Screen name="friend/[id]" options={{ title: '' }} />
        <Stack.Screen name="friend-list" options={{ title: 'LIST' }} />
      </Stack>
    </>
  );
}
