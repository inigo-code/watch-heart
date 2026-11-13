import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { HeartMark } from '@/components/BrandTitle';
import { font, fonts, useTheme } from '@/lib/theme';
import { useDiary } from '@/store/DiaryStore';

/**
 * Over the whole app when the diary couldn't be read from the phone. The app underneath would show an
 * empty diary, and anything done there could be saved or synced over the real one, so it stays covered
 * until a retry works.
 */
export function DiaryLoadFailed() {
  const theme = useTheme();
  const { loadFailed, retryLoad } = useDiary();
  const [busy, setBusy] = useState(false);
  const [tries, setTries] = useState(0);

  if (!loadFailed) return null;

  const retry = async () => {
    setBusy(true);
    const ok = await retryLoad();
    setBusy(false);
    if (!ok) setTries((n) => n + 1);
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]} accessibilityViewIsModal>
      <HeartMark size={88} />
      <View style={styles.texts}>
        <Text style={[styles.title, { color: theme.text }]} accessibilityRole="header">
          Couldn’t open your diary
        </Text>
        <Text style={[styles.body, { color: theme.textMuted }]}>
          Nothing has been deleted. Watch Heart won’t save or sync anything until your diary opens.
        </Text>
      </View>
      <Pressable
        onPress={() => void retry()}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Try again"
        style={({ pressed }) => [styles.button, { backgroundColor: theme.accent, opacity: busy ? 0.6 : pressed ? 0.85 : 1 }]}
      >
        {busy ? <ActivityIndicator color={theme.accentText} /> : <Ionicons name="refresh" size={18} color={theme.accentText} />}
        <Text style={[styles.buttonText, { color: theme.accentText }]}>Try again</Text>
      </Pressable>
      {tries > 0 && !busy && (
        <Text style={[styles.message, { color: theme.textMuted }]}>
          Still not opening. Close Watch Heart and open it again, or restart the phone.
        </Text>
      )}
    </View>
  );
}

// The same layout as the lock screen.
const styles = StyleSheet.create({
  screen: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 20, zIndex: 50 },
  texts: { alignItems: 'center', gap: 6 },
  title: { fontSize: font.largeTitle, fontFamily: fonts.display, letterSpacing: 1, textAlign: 'center' },
  body: { fontSize: font.body, textAlign: 'center', lineHeight: 21 },
  button: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, paddingHorizontal: 28, borderRadius: 24, marginTop: 8 },
  buttonText: { fontSize: font.body, fontFamily: fonts.monoBold, textTransform: 'uppercase', letterSpacing: 1 },
  message: { fontSize: font.footnote, textAlign: 'center', lineHeight: 19 },
});
