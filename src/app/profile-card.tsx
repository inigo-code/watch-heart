import { useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SectionLabel } from '@/components/SectionLabel';
import { ProfileCard } from '@/components/profile/ProfileCard';
import { today } from '@/lib/dates';
import { profileStats } from '@/lib/profileStats';
import { useTheme } from '@/lib/theme';
import { useSettings } from '@/settings/SettingsProvider';
import { useDiary } from '@/store/DiaryStore';
import { PALETTES } from '@/story/palettes';
import type { StoryHandle } from '@/story/StoryCanvas';
import { PalettePicker, ShareButtons, StoryPreview } from '@/story/Studio';

/** Your profile as an Instagram story, in any of the story palettes. */
export default function ProfileCardScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { settings, update } = useSettings();
  const { entries } = useDiary();
  const ref = useRef<StoryHandle>(null);
  const todayIso = today();
  const stats = useMemo(() => profileStats(entries, todayIso), [entries, todayIso]);

  return (
    <ScrollView style={{ backgroundColor: theme.bg }} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
      <StoryPreview width={Math.min(width - 32, 300)} theme={theme}>
        <ProfileCard
          ref={ref}
          name={settings.name}
          bio={settings.bio}
          photo={settings.photo}
          favourites={settings.favourites}
          stats={stats}
          palette={PALETTES[settings.story.palette]}
          year={todayIso.slice(0, 4)}
        />
      </StoryPreview>
      <ShareButtons target={ref} ready theme={theme} />
      <SectionLabel theme={theme}>PALETTE</SectionLabel>
      <PalettePicker value={settings.story.palette} onChange={(palette) => update({ story: { ...settings.story, palette } })} theme={theme} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16, alignItems: 'stretch' },
});
