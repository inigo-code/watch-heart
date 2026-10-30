import { Stack } from 'expo-router';
import type { ComponentProps } from 'react';

import { fonts, useTheme } from '@/lib/theme';

/**
 * Each tab's own stack. The pages in this folder (a title, an entry, a person, a list, settings…) are
 * shared by all five tabs, so they open inside the tab you're in, with the tab bar still there; the log form,
 * the poster picker and the share sheet open above the tabs, from the root.
 */
export const unstable_settings = {
  // The first page of each tab; links from outside (a notification, the widget) open in Home's stack.
  anchor: 'index',
  diary: { anchor: 'diary' },
  search: { anchor: 'search' },
  watchlist: { anchor: 'watchlist' },
  recap: { anchor: 'recap' },
};

type Options = NonNullable<ComponentProps<typeof Stack>['screenOptions']>;
type ScreenOptions = Exclude<Options, (...args: never[]) => unknown>;

// The tabs' first pages draw their own titles; the others take these.
const TAB_ROOTS = new Set(['index', 'diary', 'search', 'watchlist', 'recap']);
const PAGES: Record<string, ScreenOptions> = {
  'entry/[id]': { title: '', headerTransparent: true },
  'title/[id]': { title: '', headerTransparent: true },
  'card/[id]': { title: 'STORY CARD' },
  settings: { title: 'SETTINGS' },
  account: { title: 'ACCOUNT & SYNC' },
  trash: { title: 'TRASH' },
  import: { title: 'IMPORT' },
  about: { title: 'ABOUT' },
  profile: { title: 'PROFILE' },
  track: { title: 'EPISODES' },
  lists: { title: 'YOUR LISTS' },
  'list/[id]': { title: 'LIST' },
  'list-card/[id]': { title: 'LIST STORY' },
  'profile-card': { title: 'PROFILE CARD' },
  'credits/[id]': { title: 'CAST & CREW' },
  'person/[id]': { title: '' },
  browse: { title: 'DISCOVER' },
  friends: { title: 'FRIENDS' },
  'friend/[id]': { title: '' },
  'friend-list': { title: 'LIST' },
};

export default function TabStack() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={({ route }) => ({
        headerShown: !TAB_ROOTS.has(route.name),
        headerStyle: { backgroundColor: theme.bg },
        headerTintColor: theme.text,
        headerTitleStyle: { fontFamily: fonts.display, fontSize: 24 },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.bg },
        // Pages come in from the right with the page behind easing back a little.
        animation: 'ios_from_right',
        gestureEnabled: true,
        ...PAGES[route.name],
      })}
    />
  );
}
