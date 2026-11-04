import { Stack } from 'expo-router';
import type { ComponentProps } from 'react';

import { BackDisc } from '@/components/BackDisc';
import { PageGround } from '@/components/PageGround';
import { fonts, useTheme } from '@/lib/theme';

/**
 * Each tab's own stack. The pages in this folder (a title, an entry, a person, a list, settings…) are
 * shared by all five tabs, so they open inside the tab you're in, with the tab bar still there; the log form,
 * the poster picker and the share sheet open above the tabs, from the root.
 *
 * Every page gets the same header and ground from here: the page's glow runs up behind a see-through
 * header, and the way back is always the disc. A page only says what its title is.
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
// These run right up to the top of the screen, under the header: a backdrop, or Profile's banner.
const FLOATING = new Set(['entry/[id]', 'title/[id]', 'profile']);
const PAGES: Record<string, ScreenOptions> = {
  'entry/[id]': { title: '' },
  'title/[id]': { title: '' },
  'card/[id]': { title: 'STORY CARD' },
  settings: { title: 'SETTINGS' },
  account: { title: 'ACCOUNT & SYNC' },
  trash: { title: 'TRASH' },
  import: { title: 'IMPORT' },
  about: { title: 'ABOUT' },
  profile: { title: '' },
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
      screenLayout={({ route, children }) => <PageGround floating={TAB_ROOTS.has(route.name) || FLOATING.has(route.name)}>{children}</PageGround>}
      screenOptions={({ route }) => ({
        headerShown: !TAB_ROOTS.has(route.name),
        headerTransparent: true,
        headerStyle: { backgroundColor: 'transparent' },
        headerTintColor: FLOATING.has(route.name) ? '#FFFFFF' : theme.text,
        headerTitleStyle: { fontFamily: fonts.display, fontSize: 24 },
        headerShadowVisible: false,
        headerBackVisible: false,
        headerLeft: () => <BackDisc />,
        contentStyle: { backgroundColor: theme.bg },
        // Pages come in from the right with the page behind easing back a little.
        animation: 'ios_from_right',
        gestureEnabled: true,
        ...PAGES[route.name],
      })}
    />
  );
}
