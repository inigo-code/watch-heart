import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, TextInput } from '@/components/AppText';
import { KeyboardSafe } from '@/components/KeyboardSafe';
import { ControlRow, Row, Section, Segmented, ToggleRow } from '@/components/SettingsUI';
import { HeartMark } from '@/components/BrandTitle';
import { useFriends } from '@/friends/FriendsProvider';
import { useToast } from '@/components/Toast';
import { UpdateCard } from '@/components/UpdateRow';
import { ActionSheet } from '@/components/ActionSheet';
import { Chip } from '@/components/Film';
import { COUNTRIES, countryName, flag } from '@/lib/discover';
import { languagesFor } from '@/lib/regional';
import { omdbKey, watchRegion } from '@/api/omdb';
import { askForNotifications } from '@/lib/nudgeSchedule';
import { APP_NAME, DATA_SOURCES } from '@/lib/app';
import { tmdbKey } from '@/api';
import { exportBackup, exportCsv, exportLetterboxd, pickBackup } from '@/lib/backup';
import { ACCENTS, font, fonts, useTheme } from '@/lib/theme';
import { findPostersNow, useUpkeepProgress } from '@/lib/tmdbFreshness';
import { useAppLock } from '@/lock/AppLockProvider';
import { lockSupport } from '@/lock/authenticate';
import { LOCK_AFTER_OPTIONS } from '@/lock/lockTiming';
import { usePerks } from '@/lib/perks';
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
  const perks = usePerks();
  const friends = useFriends();
  const lock = useAppLock();
  const diary = useDiary();
  const sync = useSync();
  const [busy, setBusy] = useState<Busy>(null);
  const [keyText, setKeyText] = useState(settings.tmdbKey);
  const [showKey, setShowKey] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [pickingCountry, setPickingCountry] = useState(false);
  const region = watchRegion(settings.watchRegion);
  const phoneRegion = watchRegion('');
  const languages = languagesFor(region);
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

  // Turning one on is the moment to ask Android, if it hasn't been allowed yet.
  const setNudge = (patch: Partial<typeof settings.nudges>) => {
    update({ nudges: { ...settings.nudges, ...patch } });
    if (Object.values(patch).some(Boolean)) askForNotifications().catch(() => {});
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
    <KeyboardSafe>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Section theme={theme} title="Account and sync">
          <Row
            theme={theme}
            icon="cloud-outline"
            label={sync.email ?? 'Account & sync'}
            value={SYNC_LABEL[sync.status]}
            onPress={() => router.push('/account')}
            last
          />
        </Section>

        <Section theme={theme} title="Your profile">
          <Row
            theme={theme}
            icon="person-circle-outline"
            label={settings.name.trim() || 'Your profile'}
            value="Stats and goal"
            onPress={() => router.push('/profile')}
          />
          <Row
            theme={theme}
            icon="people-outline"
            label="Friends"
            value={friends.available ? (friends.friends.length ? `${friends.friends.length}` : 'Invite code') : 'Needs an account'}
            onPress={() => router.push('/friends')}
            last
          />
        </Section>

        {friends.available && (
          <Section theme={theme} title="What friends can see" footer="Who you watched with and your tags stay private">
            <ToggleRow
              theme={theme}
              icon="ticket-outline"
              label="Your diary and ratings"
              value={settings.sharing.diary}
              onChange={(diary) => update({ sharing: { ...settings.sharing, diary } })}
            />
            <ToggleRow
              theme={theme}
              icon="chatbubble-outline"
              label="Your reviews"
              value={settings.sharing.reviews}
              onChange={(reviews) => update({ sharing: { ...settings.sharing, reviews } })}
            />
            <ToggleRow
              theme={theme}
              icon="albums-outline"
              label="Your lists"
              value={settings.sharing.lists}
              onChange={(lists) => update({ sharing: { ...settings.sharing, lists } })}
            />
            <ToggleRow
              theme={theme}
              icon="search-outline"
              label="Let people find me by name"
              value={!!settings.sharing.findable}
              onChange={(findable) => update({ sharing: { ...settings.sharing, findable } })}
              last={!settings.sharing.findable}
            />
            {!!settings.sharing.findable && (
              <ToggleRow
                theme={theme}
                icon="person-circle-outline"
                label="Show my profile in search"
                value={!!settings.sharing.preview}
                onChange={(preview) => update({ sharing: { ...settings.sharing, preview } })}
                last
              />
            )}
          </Section>
        )}

        <Section theme={theme} title="Notifications">
          <ToggleRow theme={theme} icon="tv-outline" label="New episodes" value={settings.nudges.episodes} onChange={(episodes) => setNudge({ episodes })} />
          <ToggleRow theme={theme} icon="people-outline" label="Friend requests" value={settings.nudges.friends} onChange={(friends) => setNudge({ friends })} />
          <ToggleRow theme={theme} icon="bookmark-outline" label="Watchlist releases" value={settings.nudges.releases} onChange={(releases) => setNudge({ releases })} />
          <ToggleRow theme={theme} icon="sparkles-outline" label="Picks and new releases" value={settings.nudges.picks} onChange={(picks) => setNudge({ picks })} />
          <ToggleRow theme={theme} icon="calendar-outline" label="Monthly recap" value={settings.nudges.recap} onChange={(recap) => setNudge({ recap })} last />
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
                const open = perks.unlocked('accent', key);
                const perk = perks.perkFor('accent', key);
                return (
                  <Pressable
                    key={key}
                    onPress={() =>
                      open
                        ? update({ accent: key })
                        : toast(`${ACCENTS[key].label} is a perk: ${perk?.points} achievement points (you have ${perks.points}). Earn them on your profile.`)
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`${ACCENTS[key].label} accent${open ? '' : ', locked'}`}
                    accessibilityState={{ selected: active }}
                    style={[styles.swatchRing, { borderColor: active ? color : 'transparent' }]}
                  >
                    <View style={[styles.swatch, { backgroundColor: color, opacity: open ? 1 : 0.35 }]}>
                      {active && <Ionicons name="checkmark" size={20} color={onColor} />}
                      {!open && <Ionicons name="lock-closed" size={16} color={theme.text} />}
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
          <ToggleRow
            theme={theme}
            icon="pulse-outline"
            label="Vibrate on log and like"
            value={settings.haptics}
            onChange={(haptics) => update({ haptics })}
            last
          />
        </Section>

        <Section
          theme={theme}
          title="Region and language"
        >
          <Row
            theme={theme}
            icon="globe-outline"
            label="Country"
            value={`${countryName(region)}${settings.watchRegion ? '' : ' (phone)'}`}
            onPress={() => setPickingCountry(true)}
            last={!languages.length}
          />
          {languages.length > 0 && (
            <ControlRow theme={theme} label="Language" last>
              <View style={styles.chips}>
                <Chip theme={theme} label="Any" active={!languages.some((l) => l.code === settings.homeLanguage)} onPress={() => update({ homeLanguage: '' })} />
                {languages.map((l) => (
                  <Chip key={l.code} theme={theme} label={l.name} active={settings.homeLanguage === l.code} onPress={() => update({ homeLanguage: l.code })} />
                ))}
              </View>
            </ControlRow>
          )}
        </Section>

        <Section
          theme={theme}
          title="Film and anime search (TMDB)"
          footer={
            builtInKey
              ? 'Built in. Paste your own to replace it.'
              : 'Free for personal use'
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
          footer={omdbKey('') ? 'Built in. Paste your own to replace it.' : 'Free from omdbapi.com'}
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
          <Row theme={theme} icon="open-outline" label="Get a free key at omdbapi.com" onPress={() => Linking.openURL('https://www.omdbapi.com/apikey.aspx')} last />
        </Section>

        <Section
          theme={theme}
          title="Security"
          footer="Uses your fingerprint or screen lock"
        >
          <ToggleRow
            theme={theme}
            icon="lock-closed-outline"
            label="App lock"
            value={settings.appLock}
            onChange={(on) => void toggleLock(on)}
            last={!settings.appLock}
          />
          {settings.appLock && (
            <ControlRow theme={theme} label="Lock after leaving the app">
              <Segmented
                theme={theme}
                value={settings.lockAfter}
                onChange={(lockAfter) => update({ lockAfter })}
                options={LOCK_AFTER_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              />
            </ControlRow>
          )}
          {settings.appLock && (
            <ToggleRow
              theme={theme}
              icon="apps-outline"
              label="Show titles in the widget"
              value={settings.widgetWhileLocked}
              onChange={(widgetWhileLocked) => update({ widgetWhileLocked })}
              last
            />
          )}
        </Section>

        <Section
          theme={theme}
          title="Your data"
          footer="Importing a backup never deletes anything"
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
                const parts = [
                  `${r.added} added`,
                  r.updated ? `${r.updated} updated` : '',
                  r.skipped ? `${r.skipped} already here` : '',
                  queued ? `${queued} to watchlist` : '',
                ];
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
          <Row theme={theme} icon="enter-outline" label="Import from other apps" onPress={() => router.push('/import')} />
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
          <Row theme={theme} leading={<HeartMark size={30} />} label={`About ${APP_NAME}`} value="Heart Apps" onPress={() => router.push('/about')} />
          <Row theme={theme} icon="refresh-outline" label="Reset settings" destructive last onPress={() => setConfirmReset(true)} />
        </Section>
        <ActionSheet
        visible={pickingCountry}
        title="Your country"
        onClose={() => setPickingCountry(false)}
        actions={[
          { label: `Your phone’s: ${countryName(phoneRegion)}`, icon: 'phone-portrait-outline', onPress: () => update({ watchRegion: '' }) },
          ...[...new Set([region, ...COUNTRIES])]
            .sort((a, b) => countryName(a).localeCompare(countryName(b)))
            .map((c) => ({
              label: `${countryName(c)}${c === settings.watchRegion ? '  ✓' : ''}`,
              leading: <Text style={styles.flag}>{flag(c)}</Text>,
              onPress: () => update({ watchRegion: c }),
            })),
        ]}
      />
      <ActionSheet
          visible={confirmReset}
          title="Reset settings? The look, diary layout, story style, search and tips go back to their defaults. Your diary, watchlist, profile, account, keys and App lock stay as they are."
          onClose={() => setConfirmReset(false)}
          actions={[
            {
              label: 'Reset settings',
              icon: 'refresh-outline',
              destructive: true,
              onPress: () => {
                reset();
                toast('Settings reset to defaults');
              },
            },
          ]}
        />
      </ScrollView>
    </KeyboardSafe>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 24 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, minHeight: 52 },
  input: { flex: 1, fontSize: font.body, paddingVertical: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  flag: { fontSize: 18, width: 24, textAlign: 'center' },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatchRing: { width: 46, height: 46, borderRadius: 23, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
