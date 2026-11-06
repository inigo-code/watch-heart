import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { SectionLabel } from '@/components/SectionLabel';
import { useToast } from '@/components/Toast';
import { myBlocks, unblockPerson } from '@/friends/friendsApi';
import type { Blocked } from '@/friends/friendsApi';
import { font, fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';

/** People you've blocked, shown only when there are some. `round` reloads it when the screen is refreshed. */
export function BlockedPeople({ theme, round }: { theme: Theme; round: number }) {
  const toast = useToast();
  const [blocked, setBlocked] = useState<Blocked[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(() => {
    myBlocks()
      .then(setBlocked)
      .catch(() => {});
  }, []);
  useEffect(load, [load, round]);

  const unblock = async (b: Blocked) => {
    setBusy(b.id);
    try {
      await unblockPerson(b.id);
      setBlocked((list) => list.filter((x) => x.id !== b.id));
      toast(`Unblocked ${b.name}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Couldn’t unblock');
    } finally {
      setBusy(null);
    }
  };

  if (!blocked.length) return null;
  return (
    <View style={styles.block}>
      <SectionLabel theme={theme}>Blocked</SectionLabel>
      {blocked.map((b) => (
        <View key={b.id} style={[styles.row, { borderColor: theme.border }]}>
          <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
            {b.name}
          </Text>
          {busy === b.id ? (
            <ActivityIndicator color={theme.accent} />
          ) : (
            <Pressable onPress={() => unblock(b)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Unblock ${b.name}`} style={[styles.btn, { borderColor: theme.border }]}>
              <Text style={[styles.btnText, { color: theme.text }]}>UNBLOCK</Text>
            </Pressable>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 8 },
  name: { flex: 1, fontSize: font.body, fontWeight: '600' },
  btn: { height: 34, paddingHorizontal: 14, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: fonts.monoBold, fontSize: font.caption, letterSpacing: 1 },
});
