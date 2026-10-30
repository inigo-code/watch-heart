import { useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip } from '@/components/Film';
import { SectionLabel } from '@/components/SectionLabel';
import { font, fonts, useTheme } from '@/lib/theme';
import { useSettings } from '@/settings/SettingsProvider';
import { useDiary } from '@/store/DiaryStore';
import { ReviewCard } from '@/story/ReviewCard';
import type { StoryHandle } from '@/story/StoryCanvas';
import { PalettePicker, ShareButtons, StoryPreview } from '@/story/Studio';

/** One entry as an Instagram story: poster, stars, and a line of the review. */
export default function CardScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { ready: loaded, getEntry } = useDiary();
  const entry = getEntry(id);
  const { settings, update } = useSettings();
  const ref = useRef<StoryHandle>(null);
  const [ready, setReady] = useState(false);
  const onReady = useCallback((r: boolean) => setReady(r), []);
  const [showReview, setShowReview] = useState(true);

  if (!loaded) return <View style={{ flex: 1, backgroundColor: theme.bg }} />;
  if (!entry) {
    return (
      <View style={[styles.missing, { backgroundColor: theme.bg }]}>
        <Text style={[styles.note, { color: theme.textMuted }]}>This entry is gone.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: theme.bg }} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
      <StoryPreview width={Math.min(width - 32, 300)} theme={theme} target={ref}>
        <ReviewCard entry={entry} palette={settings.story.palette} showReview={showReview} onReady={onReady} />
      </StoryPreview>
      <ShareButtons target={ref} ready={ready} theme={theme} />
      <SectionLabel theme={theme}>PALETTE</SectionLabel>
      <PalettePicker value={settings.story.palette} onChange={(palette) => update({ story: { ...settings.story, palette } })} theme={theme} />
      {!!entry.review && (
        <>
          <SectionLabel theme={theme}>SHOW</SectionLabel>
          <View style={styles.row}>
            <Chip theme={theme} icon="reader-outline" label="Review" active={showReview} onPress={() => setShowReview((v) => !v)} />
          </View>
          {entry.spoilers && <Text style={[styles.note, { color: theme.textMuted }]}>Your review has spoilers, so it stays off the card.</Text>}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 14 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: 8 },
  note: { fontFamily: fonts.mono, fontSize: font.footnote },
});
