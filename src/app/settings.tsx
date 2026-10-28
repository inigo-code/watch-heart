import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ControlRow, Row, Section, Segmented, ToggleRow } from '@/components/SettingsUI';
import { useToast } from '@/components/Toast';
import { UpdateCard } from '@/components/UpdateRow';
import { watchRegion } from '@/api/omdb';
import { APP_NAME, DATA_SOURCES } from '@/lib/app';
import { tmdbKey } from '@/api';
import { exportBackup, exportCsv, exportLetterboxd, pickBackup } from '@/lib/backup';
import { ACCENTS, font, fonts, useTheme } from '@/lib/theme';
import { findPostersNow, useUpkeepProgress } from '@/lib/tmdbFreshness';
import { useAppLock } from '@/lock/AppLockProvider';
import { lockSupport } from '@/lock/authenticate';
import { LOCK_AFTER_OPTIONS } from '@/lock/lockTiming';
import { useSettings } from '@/settings/SettingsProvider';
import type { AccentKey } from '@/settings/SettingsProvider';
import { useDiary } from '@/store/DiaryStore';
import { useSync } from '@/sync/SyncProvider';
import type { SyncStatus } from '@/sync/SyncProvider';

const SYNC_LABEL: Record<SyncStatus, string> = {
  unconfigured: 'Not set up',
  'signed-out': 'Sign in',
  idle: 'On',
  syncing: 'Syncing…',
  waiting: 'Changes waiting',
  synced: 'Up to date',
  error: 'Needs attention',
};

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

type Busy = 'backup' | 'import' | 'csv' | 'letterboxd' | null;

export default function SettingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { settings, update, reset } = useSettings();
  const lock = useAppLock();
  const diary = useDiary();
  const sync = useSync();
  const [busy, setBusy] = useState<Busy>(null);
  const [keyText, setKeyText] = useState(settings.tmdbKey);
  const [showKey, setShowKey] = useState(false);
  const builtInKey = !!process.env.EXPO_PUBLIC_TMDB_KEY;
  const posters = useUpkeepProgress();

  const run = async (kind: Exclude<Busy, null>, fn: () => Promise<string | null>) => {
    setBusy(kind);
    try {
      const msg = await fn();
      if (msg) toast(msg);
    } catch (e) {
      toast(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  // Turning App lock on or off always asks for the phone's lock first, so someone holding an
  // unlocked phone can't quietly switch it off (or lock you out by switching it on).
  const toggleLock = async (on: boolean) => {
    if (on) {
      const support = await lockSupport();
      if (support === 'no-screen-lock') {
        toast('Set up a screen lock (PIN, pattern, password or fingerprint) in Android settings first.');
        return;
      }
      if (support === 'unsupported') {
        toast("App lock isn't available on this device.");
        return;
      }
    }
    const result = await lock.confirm(on ? 'Turn on App lock' : 'Turn off App lock');
    if (result === 'locked-out') toast('Too many tries. Wait a moment, then try again.');
    if (result !== 'ok') return;
    update({ appLock: on });
    if (on) lock.markUnlocked();
    toast(on ? 'App lock is on' : 'App lock is off');
  };

  const saveKey = () => {
    const tmdbKey = keyText.trim();
    if (tmdbKey === settings.tmdbKey) return;
    update({ tmdbKey });
    toast(tmdbKey ? 'TMDB key saved. Film search is on.' : 'TMDB key removed');
  };

  const all = [...diary.entries, ...diary.trash];
  const missingPosters = [...diary.entries, ...diary.watchlist].filter((r) => !r.posterUrl).length;
  const posterValue = posters.running ? `${posters.done}/${posters.total}` : missingPosters ? `${missingPosters} missing` : 'All found';

  return (
    <ScrollView
      style={{ backgroundColor: theme.bg }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
      keyboardShouldPersistTaps="handled"
    >
      <Section theme={theme} title="Account">
        <Row
          theme={theme}
          icon="cloud-outline"
          label={sync.email ?? 'Account & sync'}
          value={SYNC_LABEL[sync.status]}
          onPress={() => router.push('/account')}
          last
        />
      </Section>

      <Section theme={theme} title="You">
        <Row
          theme={theme}
          icon="person-circle-outline"
          label={settings.name.trim() || 'Your profile'}
          value="Stats, favourites, goal"
          onPress={() => router.push('/profile')}
          last
        />
      </Section>

      <Section theme={theme} title="Look">
        <ControlRow theme={theme} label="Screen">
          <Segmented
            theme={theme}
            value={settings.themeMode}
            onChange={(themeMode) => update({ themeMode })}
            options={[
              { value: 'dark', label: 'Projector', icon: 'moon-outline' },
              { value: 'light', label: 'Paper', icon: 'document-text-outline' },
              { value: 'system', label: 'System', icon: 'phone-portrait-outline' },
            ]}
          />
        </ControlRow>
        <ControlRow theme={theme} label="Accent" value={`${ACCENTS[settings.accent].label} · ${ACCENTS[settings.accent].note}`} last>
          <View style={styles.swatches}>
            {(Object.keys(ACCENTS) as AccentKey[]).map((key) => {
              const [color, onColor] = ACCENTS[key][theme.dark ? 'dark' : 'light'];
              const active = settings.accent === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => update({ accent: key })}
                  accessibilityLabel={`${ACCENTS[key].label} accent`}
                  accessibilityState={{ selected: active }}
                  style={[styles.swatchRing, { borderColor: active ? color : 'transparent' }]}
                >
                  <View style={[styles.swatch, { backgroundColor: color }]}>
                    {active && <Ionicons name="checkmark" size={20} color={onColor} />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ControlRow>
      </Section>

      <Section theme={theme} title="Diary">
        <ControlRow theme={theme} label="Show entries as">
          <Segmented
            theme={theme}
            value={settings.diaryLayout}
            onChange={(diaryLayout) => update({ diaryLayout })}
            options={[
              { value: 'list', label: 'Tickets', icon: 'list-outline' },
              { value: 'grid', label: 'Poster wall', icon: 'grid-outline' },
            ]}
          />
        </ControlRow>
        <ToggleRow theme={theme} icon="pulse-outline" label="Vibrate on log and like" value={settings.haptics} onChange={(haptics) => update({ haptics })} last />
      </Section>

      <Section
        theme={theme}
        title="Film and anime search (TMDB)"
        footer={
          builtInKey
            ? 'This build has a key built in, so search already works. Paste your own to use it instead.'
            : 'TMDB keys are free for personal use. TMDB powers film and anime search; series search works without a key (TVmaze), and TMDB adds better series posters.'
        }
      >
        <View style={styles.inputRow}>
          <Ionicons name="key-outline" size={18} color={theme.textMuted} />
          <TextInput
            value={keyText}
            onChangeText={setKeyText}
            onEndEditing={saveKey}
            onSubmitEditing={saveKey}
            placeholder="Paste your TMDB API key"
            placeholderTextColor={theme.textMuted}
            secureTextEntry={!showKey}
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.input, { color: theme.text, fontFamily: fonts.mono }]}
          />
          <Pressable onPress={() => setShowKey((v) => !v)} hitSlop={8} accessibilityLabel={showKey ? 'Hide key' : 'Show key'}>
            <Ionicons name={showKey ? 'eye-off-outline' : 'eye-outline'} size={18} color={theme.textMuted} />
          </Pressable>
        </View>
        <Row theme={theme} icon="open-outline" label="Get a free key at themoviedb.org" onPress={() => Linking.openURL(DATA_SOURCES.tmdb.keyUrl)} last />
      </Section>

      <Section
        theme={theme}
        title="Ratings and streaming"
        footer={`IMDb has no free official API. A free OMDb key (1,000 lookups a day) adds IMDb, Rotten Tomatoes and Metacritic scores to every title. Where to watch uses ${watchRegion(settings.watchRegion)}${settings.watchRegion ? '' : ', your phone’s country'}; type another country code to change it.`}
      >
        <View style={styles.inputRow}>
          <Ionicons name="star-half-outline" size={18} color={theme.textMuted} />
          <TextInput
            value={settings.omdbKey}
            onChangeText={(omdbKey) => update({ omdbKey: omdbKey.trim() })}
            placeholder="Paste your OMDb API key"
            placeholderTextColor={theme.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.input, { color: theme.text, fontFamily: fonts.mono }]}
          />
        </View>
        <Row theme={theme} icon="open-outline" label="Get a free key at omdbapi.com" onPress={() => Linking.openURL('https://www.omdbapi.com/apikey.aspx')} />
        <View style={styles.inputRow}>
          <Ionicons name="globe-outline" size={18} color={theme.textMuted} />
          <TextInput
            value={settings.watchRegion}
            onChangeText={(t) => update({ watchRegion: t.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2) })}
            placeholder={`Country for where to watch (now ${watchRegion('')})`}
            placeholderTextColor={theme.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={2}
            style={[styles.input, { color: theme.text, fontFamily: fonts.mono }]}
          />
        </View>
      </Section>

      <Section
        theme={theme}
        title="Security"
        footer={`App lock uses your fingerprint, face or phone screen lock, and hides your diary in the recent-apps screen. ${APP_NAME} never sees your fingerprint or PIN.`}
      >
        <ToggleRow theme={theme} icon="lock-closed-outline" label="App lock" value={settings.appLock} onChange={(on) => void toggleLock(on)} last={!settings.appLock} />
        {settings.appLock && (
          <ControlRow theme={theme} label="Lock after leaving the app" last>
            <Segmented
              theme={theme}
              value={settings.lockAfter}
              onChange={(lockAfter) => update({ lockAfter })}
              options={LOCK_AFTER_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            />
          </ControlRow>
        )}
      </Section>

      <Section
        theme={theme}
        title="Your data"
        footer="Everything is saved on this phone, and in your account when you sign in. Back up now and then; importing a backup merges it in and never deletes anything. Posters for imported titles are found automatically."
      >
        <Row
          theme={theme}
          icon="download-outline"
          label="Export backup"
          busy={busy === 'backup'}
          onPress={() => run('backup', async () => (await exportBackup(all, diary.watchlist), null))}
        />
        <Row
          theme={theme}
          icon="push-outline"
          label="Import backup"
          busy={busy === 'import'}
          onPress={() =>
            run('import', async () => {
              const backup = await pickBackup();
              if (!backup) return null;
              const r = diary.importEntries(backup.entries);
              const queued = diary.importWatchlist(backup.watchlist ?? []);
              const parts = [`${r.added} added`, r.updated ? `${r.updated} updated` : '', r.skipped ? `${r.skipped} already here` : '', queued ? `${queued} to watchlist` : ''];
              return `Imported: ${parts.filter(Boolean).join(', ')}`;
            })
          }
        />
        <Row
          theme={theme}
          icon="grid-outline"
          label="Export as spreadsheet (CSV)"
          busy={busy === 'csv'}
          onPress={() => run('csv', async () => (await exportCsv(diary.entries), null))}
        />
        <Row
          theme={theme}
          icon="film-outline"
          label="Export films for Letterboxd"
          busy={busy === 'letterboxd'}
          onPress={() =>
            run('letterboxd', async () => {
              const n = await exportLetterboxd(diary.entries);
              return n ? null : 'No films in your diary yet';
            })
          }
        />
        <Row theme={theme} icon="enter-outline" label="Import from other apps" value="Letterboxd, IMDb…" onPress={() => router.push('/import')} />
        <Row
          theme={theme}
          icon="images-outline"
          label="Find missing posters"
          value={posterValue}
          busy={posters.running}
          onPress={
            missingPosters && !posters.running
              ? () => {
                  if (!tmdbKey(settings.tmdbKey)) toast('Add your TMDB key above first');
                  else {
                    findPostersNow();
                    toast('Looking for posters in the background');
                  }
                }
              : undefined
          }
        />
        <Row theme={theme} icon="trash-outline" label="Trash" value={String(diary.trash.length)} onPress={() => router.push('/trash')} last />
      </Section>

      <UpdateCard theme={theme} />

      <Section theme={theme} title="About">
        <Row theme={theme} icon="information-circle-outline" label={`About ${APP_NAME}`} onPress={() => router.push('/about')} />
        <Row
          theme={theme}
          icon="refresh-outline"
          label="Reset settings"
          destructive
          last
          onPress={() => {
            reset();
            toast('Settings reset to defaults');
          }}
        />
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 24 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, minHeight: 52 },
  input: { flex: 1, fontSize: font.body, paddingVertical: 12 },
  swatches: { flexDirection: 'row', gap: 10 },
  swatchRing: { width: 46, height: 46, borderRadius: 23, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
