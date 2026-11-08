import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/AppText';
import { Chip } from '@/components/Film';
import { SectionLabel } from '@/components/SectionLabel';
import { useToast } from '@/components/Toast';
import { pickMemoryPhoto } from '@/lib/memoryPhoto';
import { font, fonts, useTheme } from '@/lib/theme';
import { useSettings } from '@/settings/SettingsProvider';
import { useDiary } from '@/store/DiaryStore';
import { MemoryCard } from '@/story/MemoryCard';
import { ReviewCard } from '@/story/ReviewCard';
import type { StoryHandle } from '@/story/StoryCanvas';
import { PalettePicker, ShareButtons, StoryPreview } from '@/story/Studio';

/** One entry as an Instagram story: the review card (poster, stars, a line of the review) or a memory (your own photo in a film frame). */
export default function CardScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { id, style } = useLocalSearchParams<{ id: string; style?: string }>();
  const toast = useToast();
  const [memory, setMemory] = useState(style === 'memory');
  const [photo, setPhoto] = useState<string | null>(null);
  const { ready: loaded, getEntry } = useDiary();
  const entry = getEntry(id);
  const { settings, update } = useSettings();
  const ref = useRef<StoryHandle>(null);
  const [ready, setReady] = useState(false);
  const onReady = useCallback((r: boolean) => setReady(r), []);
  const [showReview, setShowReview] = useState(true);
  const choose = async () => {
    try {
      const uri = await pickMemoryPhoto();
      if (uri) setPhoto(uri);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Couldn’t open that photo');
    }
  };

  if (!loaded) return <View style={{ flex: 1 }} />;
  if (!entry) {
    return (
      <View style={styles.missing}>
        <Text style={[styles.note, { color: theme.textMuted }]}>This entry is gone.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
      <View style={styles.row}>
        <Chip theme={theme} icon="ticket-outline" label="Review" active={!memory} onPress={() => setMemory(false)} />
        <Chip theme={theme} icon="images-outline" label="Memory" active={memory} onPress={() => setMemory(true)} />
      </View>
      <StoryPreview width={Math.min(width - 32, 300)} theme={theme} target={ref}>
        {memory ? (
          <MemoryCard key="memory" entry={entry} photo={photo} palette={settings.story.palette} onReady={onReady} />
        ) : (
          <ReviewCard key="review" entry={entry} palette={settings.story.palette} showReview={showReview} onReady={onReady} />
        )}
      </StoryPreview>
      {memory && (
        <Pressable onPress={choose} accessibilityRole="button" style={({ pressed }) => [styles.pick, { borderColor: theme.accent, opacity: pressed ? 0.7 : 1 }]}>
          <Ionicons name="image-outline" size={18} color={theme.accent} />
          <Text style={[styles.pickText, { color: theme.text }]}>{photo ? 'CHOOSE ANOTHER PHOTO' : 'CHOOSE A PHOTO'}</Text>
        </Pressable>
      )}
      <ShareButtons target={ref} ready={ready} theme={theme} />
      {memory && <Text style={[styles.note, { color: theme.textMuted }]}>The photo goes only into this story. Watch Heart doesn’t keep or upload it.</Text>}
      <SectionLabel theme={theme}>PALETTE</SectionLabel>
      <PalettePicker value={settings.story.palette} onChange={(palette) => update({ story: { ...settings.story, palette } })} theme={theme} />
      {!memory && !!entry.review && (
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
  pick: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 24, borderWidth: 1.5 },
  pickText: { fontFamily: fonts.monoBold, fontSize: font.footnote, letterSpacing: 1 },
});
