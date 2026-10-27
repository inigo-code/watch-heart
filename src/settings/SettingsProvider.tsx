import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { storage } from '@/lib/storage';
import type { MediaKind } from '@/store/types';
import type { PaletteKey, StoryLayout } from '@/story/palettes';

const STORAGE_KEY = 'watchheart/settings';

export type ThemeMode = 'system' | 'light' | 'dark';
export type AccentKey = 'marquee' | 'velvet' | 'neon' | 'sakura' | 'noir';

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
};

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

  const update = useCallback((patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })), []);
  // Resetting keeps the app lock, your name and your TMDB key: those should only change deliberately.
  const reset = useCallback(
    () => setSettings((s) => ({ ...DEFAULT_SETTINGS, appLock: s.appLock, lockAfter: s.lockAfter, name: s.name, tmdbKey: s.tmdbKey })),
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
