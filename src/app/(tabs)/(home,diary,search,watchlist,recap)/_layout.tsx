import { Stack } from 'expo-router';
import type { ComponentProps } from 'react';

import { BackDisc } from '@/components/BackDisc';
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
// These pages run up to the top of the screen, a backdrop or the page's own glow, so their header has no
// ground of its own and the way back sits on a disc that reads over anything.
const FLOATING: ScreenOptions = {
  title: '',
  headerTransparent: true,
  headerStyle: { backgroundColor: 'transparent' },
  headerBackVisible: false,
  headerLeft: () => <BackDisc />,
};
const PAGES: Record<string, ScreenOptions> = {
  'entry/[id]': FLOATING,
  'title/[id]': FLOATING,
  'card/[id]': { title: 'STORY CARD' },
  settings: FLOATING,
  account: { title: 'ACCOUNT & SYNC' },
  trash: { title: 'TRASH' },
  import: { title: 'IMPORT' },
  about: { title: 'ABOUT' },
  profile: FLOATING,
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
