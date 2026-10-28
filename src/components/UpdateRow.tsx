import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useToast } from '@/components/Toast';
import { font, fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';

// Updates download on launch and apply on the next restart; this card shows where things stand and
// checks or applies one now. The update APIs reject in Expo Go, dev builds and the web preview.
const canUpdate = Updates.isEnabled && !__DEV__;

/** What's running: "1.0.0 · update 5bdf7e74, 27 Oct" or "1.0.0 · built-in". */
export function describeRunning(): string {
  const version = Constants.expoConfig?.version ?? '';
  if (!canUpdate) return `${version} · development`;
  if (Updates.isEmbeddedLaunch || !Updates.updateId) return `${version} · built-in`;
  const when = Updates.createdAt ? Updates.createdAt.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '';
  return `${version} · update ${Updates.updateId.slice(0, 8)}${when ? `, ${when}` : ''}`;
}

type State = 'dev' | 'checking' | 'downloading' | 'ready' | 'latest' | 'idle';

/** A ticket stub: what's installed, whether a newer cut exists, and one button that does the next step. */
export function UpdateCard({ theme }: { theme: Theme }) {
  if (!canUpdate) return <Card theme={theme} state="dev" />;
  return <LiveCard theme={theme} />;
}

function LiveCard({ theme }: { theme: Theme }) {
  const toast = useToast();
  const u = Updates.useUpdates();
  const [checked, setChecked] = useState(false);
  const [restarting, setRestarting] = useState(false);

  const state: State = u.isChecking ? 'checking' : u.isDownloading ? 'downloading' : u.isUpdatePending ? 'ready' : checked && !u.isUpdateAvailable ? 'latest' : 'idle';

  const act = async () => {
    try {
      if (u.isUpdatePending) {
        setRestarting(true);
        await Updates.reloadAsync();
        return;
      }
      const r = await Updates.checkForUpdateAsync();
      setChecked(true);
      if (r.isAvailable) await Updates.fetchUpdateAsync();
    } catch (e) {
      setRestarting(false);
      toast(`Couldn’t check for updates: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return <Card theme={theme} state={restarting ? 'downloading' : state} lastCheck={u.lastCheckForUpdateTimeSinceRestart} onPress={act} />;
}

const COPY: Record<State, { title: string; body: string; button?: string; icon: keyof typeof Ionicons.glyphMap }> = {
  dev: { title: 'Preview build', body: 'Updates arrive in the installed app.', icon: 'construct-outline' },
  idle: { title: 'Now showing', body: 'New versions download by themselves and play from the next launch.', button: 'Check for updates', icon: 'film-outline' },
  checking: { title: 'Checking…', body: 'Looking for a newer cut.', icon: 'search' },
  downloading: { title: 'Downloading…', body: 'Fetching the new cut. Your diary is safe.', icon: 'cloud-download-outline' },
  ready: { title: 'A new cut is ready', body: 'Improvements and fixes have downloaded. Restart to start using them.', button: 'Restart now', icon: 'sparkles' },
  latest: { title: 'You’re up to date', body: 'This is the latest cut of Watch Heart.', button: 'Check again', icon: 'checkmark-circle' },
};

function Card({ theme, state, lastCheck, onPress }: { theme: Theme; state: State; lastCheck?: Date; onPress?: () => void }) {
  const c = COPY[state];
  const busy = state === 'checking' || state === 'downloading';
  const ready = state === 'ready';
  const checkedAt = lastCheck ? lastCheck.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : null;
  return (
    <View style={[styles.card, { backgroundColor: ready ? theme.accentSoft : theme.card, borderColor: ready ? theme.accent : theme.border }]}>
      <View style={styles.face}>
        <View style={[styles.badge, { backgroundColor: ready ? theme.accent : theme.elevated }]}>
          {busy ? <ActivityIndicator color={theme.accent} /> : <Ionicons name={c.icon} size={22} color={ready ? theme.accentText : theme.accent} />}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.title, { color: theme.text }]}>{c.title.toUpperCase()}</Text>
          <Text style={[styles.body, { color: theme.textMuted }]}>{c.body}</Text>
        </View>
      </View>
      {/* The tear line, with notches in the screen's colour. */}
      <View style={styles.tear}>
        <View style={[styles.notch, styles.notchLeft, { backgroundColor: theme.bg }]} />
        <View style={[styles.dots, { borderColor: ready ? theme.accent + '66' : theme.border }]} />
        <View style={[styles.notch, styles.notchRight, { backgroundColor: theme.bg }]} />
      </View>
      <View style={styles.stub}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.meta, { color: theme.textMuted }]}>VERSION {describeRunning().toUpperCase()}</Text>
          {checkedAt && <Text style={[styles.meta, { color: theme.textMuted }]}>CHECKED AT {checkedAt.toUpperCase()}</Text>}
        </View>
        {c.button && onPress && (
          <Pressable
            onPress={onPress}
            disabled={busy}
            accessibilityRole="button"
            style={({ pressed }) => [styles.button, { backgroundColor: ready ? theme.accent : theme.chipActive, opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={[styles.buttonText, { color: ready ? theme.accentText : theme.chipActiveText }]}>{c.button.toUpperCase()}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  face: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  badge: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.display, fontSize: font.title2, letterSpacing: 1 },
  body: { fontSize: font.footnote, lineHeight: 18 },
  tear: { height: 16, justifyContent: 'center' },
  dots: { marginHorizontal: 14, borderTopWidth: 2, borderStyle: 'dotted' },
  notch: { position: 'absolute', width: 16, height: 16, borderRadius: 8 },
  notchLeft: { left: -8 },
  notchRight: { right: -8 },
  stub: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 14 },
  meta: { fontFamily: fonts.mono, fontSize: font.caption, letterSpacing: 0.5 },
  button: { height: 38, paddingHorizontal: 16, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontFamily: fonts.monoBold, fontSize: font.caption, letterSpacing: 1 },
});
