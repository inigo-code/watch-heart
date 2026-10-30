import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { storage } from '@/lib/storage';
import type { MediaKind } from '@/store/types';
import type { PaletteKey, StoryLayout } from '@/story/palettes';

const STORAGE_KEY = 'watchheart/settings';

export type ThemeMode = 'system' | 'light' | 'dark';
/** The accents; emerald and platinum are perks, earned with achievements (src/lib/perks.ts). */
export type AccentKey = 'marquee' | 'velvet' | 'neon' | 'sakura' | 'noir' | 'emerald' | 'platinum';

/** A title pinned to the profile: enough to show its poster and open it. */
export type Favourite = { kind: MediaKind; source: string; sourceId: string; title: string; year: number | null; posterUrl: string | null };

/** A night planned for a title: when, and the reminder scheduled for it. */
export type MovieNight = {
  key: string;
  reminderId: string | null;
  at: number;
  kind: MediaKind;
  source: string;
  sourceId: string;
  title: string;
  year: number | null;
  posterUrl: string | null;
  backdropUrl: string | null;
};

export type Settings = {
  themeMode: ThemeMode;
  accent: AccentKey;
  /** Your name, for the greeting on the Diary. */
  name: string;
  /** Diary as ticket stubs (list) or a poster wall (grid). */
  diaryLayout: 'list' | 'grid';
  /** The kind the Search tab opens on. */
  searchKind: MediaKind;
  haptics: boolean;
  /**
   * Your own free TMDB key (v3 API key or v4 read access token). Overrides the one built into the app,
   * if any. Without either, TV search falls back to TVmaze and movie search is off.
   */
  tmdbKey: string;
  /** Last-used recap story style. */
  story: { layout: StoryLayout; palette: PaletteKey; ratings: boolean; stats: boolean; ranked: boolean };
  /** One-time tips the user has closed. */
  dismissedTips: string[];
  /** Ask for fingerprint, face or the phone's screen lock to open the app. */
  appLock: boolean;
  /** How long the app can be in the background before it locks again, in seconds (0 = straight away). */
  lockAfter: 0 | 60 | 300;
  /** The profile: a line about you, a photo saved in the app's files, and four favourite titles. */
  bio: string;
  photo: string | null;
  favourites: Favourite[];
  /** Titles to watch this year (0 = no goal). */
  yearGoal: number;
  /** What friends can see: your diary and ratings, your reviews, your lists. Synced with the profile. */
  sharing: Sharing;
  /** Your free OMDb key, for IMDb ratings on titles. */
  omdbKey: string;
  /** Country for "Where to watch", e.g. "IN" ('' = the phone's region). */
  watchRegion: string;
  /** The update whose "What's new" card was already shown. */
  seenUpdate: string | null;
  /** Your language for Home's regional picks, e.g. "ta" ('' = any). Only used where the country has several. */
  homeLanguage: string;
  /** Movie nights you planned, with the reminder's id (null: planned without one). */
  movieNights: MovieNight[];
  /** When the profile (name, bio, photo, favourites, goal) last changed here, and when sync last matched it. */
  profileUpdatedAt: number;
  profileSyncedAt: number;
  /** Where the photo above is in the cloud (null: not uploaded yet, or none). */
  photoPath: string | null;
};

/** The settings that make up your profile, synced across devices when you're signed in. */
export const PROFILE_KEYS = ['name', 'bio', 'photo', 'favourites', 'yearGoal', 'sharing'] as const;

/** What friends can see, and whether people can find you by name (off unless you turn it on). */
export type Sharing = { diary: boolean; reviews: boolean; lists: boolean; findable: boolean };

export const DEFAULT_SETTINGS: Settings = {
  themeMode: 'dark',
  accent: 'marquee',
  name: '',
  diaryLayout: 'list',
  searchKind: 'movie',
  haptics: true,
  tmdbKey: '',
  story: { layout: 'strip', palette: 'marquee', ratings: true, stats: true, ranked: false },
  dismissedTips: [],
  appLock: false,
  lockAfter: 60,
  bio: '',
  photo: null,
  favourites: [],
  yearGoal: 0,
  sharing: { diary: true, reviews: true, lists: true, findable: false },
  omdbKey: '',
  watchRegion: '',
  homeLanguage: '',
  seenUpdate: null,
  movieNights: [],
  profileUpdatedAt: 0,
  profileSyncedAt: 0,
  photoPath: null,
};

type SettingsContext = {
  settings: Settings;
  /** False until saved settings are loaded (so the app lock never flashes the app open first). */
  ready: boolean;
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
};

const Ctx = createContext<SettingsContext | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const loaded = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    storage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw) as Partial<Settings>;
        // Merge the story style too, so options added in later versions get their default.
        setSettings({ ...DEFAULT_SETTINGS, ...saved, story: { ...DEFAULT_SETTINGS.story, ...saved.story } });
      })
      .catch(() => {})
      .finally(() => {
        loaded.current = true;
        setReady(true);
      });
  }, []);

  useEffect(() => {
    if (loaded.current) storage.setItem(STORAGE_KEY, JSON.stringify(settings)).catch(() => {});
  }, [settings]);

  // Changing the profile here stamps it, so sync sends it (sync's own changes carry their stamp).
  const update = useCallback(
    (patch: Partial<Settings>) =>
      setSettings((s) => {
        const touched = patch.profileUpdatedAt === undefined && PROFILE_KEYS.some((k) => k in patch && patch[k] !== s[k]);
        return { ...s, ...patch, ...(touched ? { profileUpdatedAt: Date.now() } : {}) };
      }),
    [],
  );
  // Resetting keeps the app lock, your profile, goal and keys: those should only change deliberately.
  const reset = useCallback(
    () =>
      setSettings((s) => ({
        ...DEFAULT_SETTINGS,
        appLock: s.appLock,
        lockAfter: s.lockAfter,
        name: s.name,
        bio: s.bio,
        photo: s.photo,
        favourites: s.favourites,
        yearGoal: s.yearGoal,
        sharing: s.sharing,
        tmdbKey: s.tmdbKey,
        omdbKey: s.omdbKey,
        seenUpdate: s.seenUpdate,
        movieNights: s.movieNights,
        profileUpdatedAt: s.profileUpdatedAt,
        profileSyncedAt: s.profileSyncedAt,
        photoPath: s.photoPath,
      })),
    [],
  );

  const value = useMemo(() => ({ settings, ready, update, reset }), [settings, ready, update, reset]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSettings() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}
