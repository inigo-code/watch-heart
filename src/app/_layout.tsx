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
import { SplashOverlay } from '@/components/SplashOverlay';
import { UpdatePrompt } from '@/components/UpdatePrompt';
import { fonts, useTheme } from '@/lib/theme';
import { useMovieNightTaps } from '@/lib/movieNight';
import { useTmdbFreshness } from '@/lib/tmdbFreshness';
import { AppLockProvider } from '@/lock/AppLockProvider';
import { FriendsProvider } from '@/friends/FriendsProvider';
import { ListsProvider } from '@/lists/ListsProvider';
import { SettingsProvider, useSettings } from '@/settings/SettingsProvider';
import { DiaryStoreProvider, useDiary } from '@/store/DiaryStore';
import { SyncProvider } from '@/sync/SyncProvider';
import { WidgetSync } from '@/widget/WidgetSync';

// Keep the splash up until the fonts, settings and diary are in, so the first thing on screen is the diary
// itself: no titles in the fallback font, no empty Diary that fills a moment later.
SplashScreen.preventAutoHideAsync().catch(() => {});

// Receiving shares needs the native module, which web and Expo Go don't have.
const shareDisabled = Platform.OS === 'web' || Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ BebasNeue_400Regular, CourierPrime_400Regular, CourierPrime_700Bold });

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
  const { ready } = useDiary();
  const { ready: settingsReady } = useSettings();
  useTmdbFreshness();
  useMovieNightTaps();

  // The native splash hands over to SplashOverlay, which lifts once the diary and settings are in. This
  // is only a safety net, should the overlay never draw.
  useEffect(() => {
    const timer = setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 4000);
    return () => clearTimeout(timer);
  }, []);

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
          // One way of moving everywhere: pages come in from the right with the page behind easing back a
          // little (smoother than a plain slide); the log form rises from below.
          animation: 'ios_from_right',
          gestureEnabled: true,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="log" options={{ title: '', presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="entry/[id]" options={{ title: '', headerTransparent: true }} />
        <Stack.Screen name="card/[id]" options={{ title: 'STORY CARD' }} />
        <Stack.Screen name="poster/[id]" options={{ title: 'CHOOSE A POSTER' }} />
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
      <SplashOverlay ready={ready && settingsReady} />
    </>
  );
}
