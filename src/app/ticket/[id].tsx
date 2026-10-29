import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tmdbKey } from '@/api';
import { aboutTmdb } from '@/api/tmdb';
import { Chip } from '@/components/Film';
import { SectionLabel } from '@/components/SectionLabel';
import { font, fonts, useTheme } from '@/lib/theme';
import { useSettings } from '@/settings/SettingsProvider';
import { useDiary } from '@/store/DiaryStore';
import { ExportFrame } from '@/story/ExportFrame';
import type { StoryHandle } from '@/story/StoryCanvas';
import { ShareButtons } from '@/story/Studio';
import { TICKET_H, TICKET_LOOKS, TICKET_W, Ticket } from '@/story/Ticket';

/** One viewing as an Indian cinema ticket, in the look you choose, to save or share. */
export default function TicketScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { ready: loaded, getEntry } = useDiary();
  const entry = getEntry(id);
  const { settings, update } = useSettings();
  const key = tmdbKey(settings.tmdbKey);
  const look = settings.ticketLook;
  const ref = useRef<StoryHandle>(null);
  const linked = entry?.source === 'tmdb' && !!entry.sourceId && !!key;
  const sourceId = entry?.sourceId ?? '';
  // The release date, for the FDFS stamp; a ticket without one says something else.
  const [released, setReleased] = useState<{ for: string; date: string | null } | null>(null);
  const [posterFor, setPosterFor] = useState<string | null>(null);

  useEffect(() => {
    if (!linked) return;
    let live = true;
    aboutTmdb(key, sourceId)
      .then((a) => live && setReleased({ for: sourceId, date: a.released }))
      .catch(() => live && setReleased({ for: sourceId, date: null }));
    return () => {
      live = false;
    };
  }, [linked, key, sourceId]);

  if (!loaded) return <View style={{ flex: 1, backgroundColor: theme.bg }} />;
  if (!entry) {
    return (
      <View style={[styles.missing, { backgroundColor: theme.bg }]}>
        <Text style={[styles.note, { color: theme.textMuted }]}>This entry is gone.</Text>
      </View>
    );
  }

  const date = released?.for === sourceId ? released.date : null;
  // Ready once the poster (the multiplex look prints it) and the release date (for the stamp) are in.
  const posterReady = look !== 'thermal' || !entry.posterUrl || posterFor === entry.posterUrl;
  const dateReady = !linked || released?.for === sourceId;
  const h = TICKET_H[look];

  return (
    <ScrollView style={{ backgroundColor: theme.bg }} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
      <ExportFrame w={TICKET_W} h={h} width={width - 32} theme={theme} target={ref}>
        <Ticket entry={entry} look={look} released={date} onPoster={() => setPosterFor(entry.posterUrl)} />
      </ExportFrame>
      <ShareButtons target={ref} ready={posterReady && dateReady} theme={theme} size={{ w: TICKET_W, h }} label="SHARE TICKET" />
      <SectionLabel theme={theme}>LOOK</SectionLabel>
      <View style={styles.row}>
        {TICKET_LOOKS.map((l) => (
          <Chip key={l.key} theme={theme} label={l.label} active={look === l.key} onPress={() => update({ ticketLook: l.key })} />
        ))}
      </View>
      <Text style={[styles.note, { color: theme.textMuted }]}>
        The serial, seat and show are made up for fun, the same every time. The FDFS stamp is real: it shows when you logged a film within three days
        of its release.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 14 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  note: { fontFamily: fonts.mono, fontSize: font.footnote, lineHeight: 18 },
});
