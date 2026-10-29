import { useLocalSearchParams } from 'expo-router';
import { useRef } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ListStoryCard } from '@/components/lists/ListStoryCard';
import { SectionLabel } from '@/components/SectionLabel';
import { font, fonts, useTheme } from '@/lib/theme';
import { useLists } from '@/lists/ListsProvider';
import { useSettings } from '@/settings/SettingsProvider';
import { PALETTES } from '@/story/palettes';
import type { StoryHandle } from '@/story/StoryCanvas';
import { PalettePicker, ShareButtons, StoryPreview } from '@/story/Studio';

/** A list as an Instagram story, in any of the story palettes. */
export default function ListCardScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { ready, getList } = useLists();
  const list = getList(id);
  const { settings, update } = useSettings();
  const ref = useRef<StoryHandle>(null);

  if (!ready) return <View style={{ flex: 1, backgroundColor: theme.bg }} />;
  if (!list) return <Text style={[styles.note, { color: theme.textMuted, padding: 24 }]}>This list is gone.</Text>;

  return (
    <ScrollView style={{ backgroundColor: theme.bg }} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
      <StoryPreview width={Math.min(width - 32, 300)} theme={theme}>
        <ListStoryCard ref={ref} list={list} palette={PALETTES[settings.story.palette]} name={settings.name} />
      </StoryPreview>
      <ShareButtons target={ref} ready theme={theme} />
      <SectionLabel theme={theme}>Palette</SectionLabel>
      <PalettePicker value={settings.story.palette} onChange={(palette) => update({ story: { ...settings.story, palette } })} theme={theme} />
      <Text style={[styles.note, { color: theme.textMuted }]}>
        {list.ranked ? 'Ranked lists show the top ten as numbered rows.' : 'Shows the first twelve posters; turn on Ranked for a numbered top ten.'}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16 },
  note: { fontFamily: fonts.mono, fontSize: font.caption, lineHeight: 16 },
});
