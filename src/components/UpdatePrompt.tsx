import Ionicons from '@expo/vector-icons/Ionicons';
import * as Updates from 'expo-updates';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, AppState, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { HeartMark } from '@/components/BrandTitle';
import { WHATS_NEW } from '@/lib/app';
import { font, fonts, useTheme } from '@/lib/theme';
import type { Theme } from '@/lib/theme';
import { useSettings } from '@/settings/SettingsProvider';

// Only real builds receive over-the-air updates; dev, Expo Go and web don't.
const enabled = Updates.isEnabled && !__DEV__;

/**
 * Pops up when an over-the-air update has finished downloading, and once after it's installed with
 * what's new. Updates are checked on launch (expo-updates does that itself) and on every return to the app.
 */
export function UpdatePrompt() {
  if (!enabled) return null;
  return <UpdatePromptInner />;
}

function UpdatePromptInner() {
  const theme = useTheme();
  const { settings, ready, update } = useSettings();
  const { isUpdatePending, isUpdateAvailable, isDownloading } = Updates.useUpdates();
  const [dismissed, setDismissed] = useState(false);
  const [restarting, setRestarting] = useState(false);

  // Check again on resume, and download anything found so the pop-up can offer it.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      Updates.checkForUpdateAsync()
        .then((r) => (r.isAvailable ? Updates.fetchUpdateAsync() : undefined))
        .then(() => setDismissed(false))
        .catch(() => {});
    });
    return () => sub.remove();
  }, []);

  // Found at launch but not downloaded yet: fetch it.
  useEffect(() => {
    if (isUpdateAvailable && !isUpdatePending && !isDownloading) Updates.fetchUpdateAsync().catch(() => {});
  }, [isUpdateAvailable, isUpdatePending, isDownloading]);

  // Just updated, with news that hasn't been shown yet. A fresh install starts on the built-in cut and
  // records the news as seen, so it only shows after an update.
  const fresh = Updates.isEmbeddedLaunch;
  useEffect(() => {
    if (ready && fresh && settings.seenUpdate !== WHATS_NEW.id) update({ seenUpdate: WHATS_NEW.id });
  }, [ready, fresh, settings.seenUpdate, update]);
  const showNews = ready && !fresh && settings.seenUpdate !== WHATS_NEW.id && !isUpdatePending;

  if (showNews) {
    return (
      <Ticket theme={theme} onClose={() => update({ seenUpdate: WHATS_NEW.id })}>
        <Text style={[styles.kicker, { color: theme.accent }]}>NOW SHOWING</Text>
        <Text style={[styles.title, { color: theme.text }]}>What’s new in this cut</Text>
        <View style={styles.list}>
          {WHATS_NEW.items.map((item) => (
            <View key={item} style={styles.item}>
              <Ionicons name="sparkles" size={14} color={theme.accent} style={{ marginTop: 3 }} />
              <Text style={[styles.itemText, { color: theme.text }]}>{item}</Text>
            </View>
          ))}
        </View>
        <Primary theme={theme} label="Let’s go" onPress={() => update({ seenUpdate: WHATS_NEW.id })} />
      </Ticket>
    );
  }

  return (
    <Ticket theme={theme} visible={isUpdatePending && !dismissed} onClose={() => setDismissed(true)}>
      <HeartMark theme={theme} size={64} />
      <Text style={[styles.title, { color: theme.text }]}>A new cut is ready</Text>
      <Text style={[styles.body, { color: theme.textMuted }]}>Improvements and fixes have downloaded. Restart to start using them. It takes a second, and your diary is safe.</Text>
      <Primary
        theme={theme}
        label="Restart now"
        busy={restarting}
        onPress={() => {
          setRestarting(true);
          Updates.reloadAsync().catch(() => setRestarting(false));
        }}
      />
      <Pressable onPress={() => setDismissed(true)} style={styles.secondary} accessibilityRole="button">
        <Text style={[styles.secondaryText, { color: theme.textMuted }]}>Later</Text>
      </Pressable>
    </Ticket>
  );
}

/** An admission ticket on a dimmed screen: the face above the tear line, the action on the stub. */
function Ticket({ theme, visible = true, onClose, children }: { theme: Theme; visible?: boolean; onClose: () => void; children: ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: theme.overlay }]}>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.accent + '55' }]}>
          <View style={[styles.punch, styles.punchLeft, { backgroundColor: theme.overlay }]} />
          <View style={[styles.punch, styles.punchRight, { backgroundColor: theme.overlay }]} />
          {children}
        </View>
      </View>
    </Modal>
  );
}

function Primary({ theme, label, onPress, busy }: { theme: Theme; label: string; onPress: () => void; busy?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.primary, { backgroundColor: theme.accent, opacity: pressed ? 0.85 : 1 }]} accessibilityRole="button">
      {busy ? <ActivityIndicator color={theme.accentText} /> : <Text style={[styles.primaryText, { color: theme.accentText }]}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  card: { width: '100%', maxWidth: 380, borderRadius: 20, borderWidth: 1, padding: 24, alignItems: 'center', gap: 10, overflow: 'hidden' },
  punch: { position: 'absolute', top: '58%', width: 22, height: 22, borderRadius: 11 },
  punchLeft: { left: -11 },
  punchRight: { right: -11 },
  kicker: { fontFamily: fonts.monoBold, fontSize: font.caption, letterSpacing: 2 },
  title: { fontSize: font.largeTitle, fontFamily: fonts.display, letterSpacing: 1, textAlign: 'center', marginTop: 4 },
  body: { fontSize: font.body, lineHeight: 20, textAlign: 'center' },
  list: { alignSelf: 'stretch', gap: 10, marginTop: 6 },
  item: { flexDirection: 'row', gap: 10 },
  itemText: { flex: 1, fontSize: font.body, lineHeight: 20 },
  primary: { alignSelf: 'stretch', height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  primaryText: { fontSize: font.body, fontFamily: fonts.monoBold, textTransform: 'uppercase', letterSpacing: 1 },
  secondary: { paddingVertical: 8, paddingHorizontal: 20 },
  secondaryText: { fontSize: font.body, fontWeight: '700' },
});
