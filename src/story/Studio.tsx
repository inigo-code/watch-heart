import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useToast } from '@/components/Toast';
import { font, fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';

import { PALETTES } from './palettes';
import type { PaletteKey } from './palettes';
import { captureStory, saveImage, shareImage } from './share';
import { STORY_H, STORY_W } from './StoryCanvas';
import type { StoryHandle } from './StoryCanvas';

// Shared pieces of the story screens: the scaled-down preview, the palette picker and the share buttons.

/**
 * Shows a full-size story at `width`. The scale is on this wrapper, not the story itself, so the
 * captured image is always the full 360×640 layout.
 */
export function StoryPreview({ width, theme, children }: { width: number; theme: Theme; children: ReactNode }) {
  const scale = width / STORY_W;
  return (
    <View style={[styles.preview, { width, height: STORY_H * scale, borderColor: theme.border }]}>
      <View style={{ width: STORY_W, height: STORY_H, transform: [{ scale }], transformOrigin: 'top left' }}>{children}</View>
    </View>
  );
}

export function PalettePicker({ value, onChange, theme }: { value: PaletteKey; onChange: (p: PaletteKey) => void; theme: Theme }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.palettes}>
      {(Object.keys(PALETTES) as PaletteKey[]).map((key) => {
        const p = PALETTES[key];
        const active = key === value;
        return (
          <Pressable key={key} onPress={() => onChange(key)} accessibilityRole="button" accessibilityState={{ selected: active }} style={styles.palette}>
            <View style={[styles.paletteRing, { borderColor: active ? theme.accent : 'transparent' }]}>
              <LinearGradient colors={p.bg} style={styles.paletteSwatch}>
                <View style={[styles.paletteDot, { backgroundColor: p.accent }]} />
              </LinearGradient>
            </View>
            <Text style={[styles.paletteLabel, { color: active ? theme.text : theme.textMuted }]}>{p.label.toUpperCase()}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** "Share to story" and "Save to photos". Disabled until every poster in the story has loaded. */
export function ShareButtons({ target, ready, theme }: { target: RefObject<StoryHandle | null>; ready: boolean; theme: Theme }) {
  const toast = useToast();
  const [busy, setBusy] = useState<'share' | 'save' | null>(null);

  const run = async (kind: 'share' | 'save') => {
    setBusy(kind);
    try {
      const uri = await captureStory(target);
      if (kind === 'share') await shareImage(uri);
      else {
        await saveImage(uri);
        toast('Saved to your photos');
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.buttons}>
      <Pressable
        onPress={() => run('share')}
        disabled={!ready || busy !== null}
        accessibilityRole="button"
        style={({ pressed }) => [styles.primary, { backgroundColor: theme.accent, opacity: !ready || busy ? 0.6 : pressed ? 0.85 : 1 }]}
      >
        {busy === 'share' ? <ActivityIndicator color={theme.accentText} /> : <Ionicons name="logo-instagram" size={20} color={theme.accentText} />}
        <Text style={[styles.primaryText, { color: theme.accentText }]}>{ready ? 'SHARE TO STORY' : 'LOADING POSTERS…'}</Text>
      </Pressable>
      <Pressable
        onPress={() => run('save')}
        disabled={!ready || busy !== null}
        accessibilityRole="button"
        accessibilityLabel="Save to photos"
        style={({ pressed }) => [styles.secondary, { borderColor: theme.border, opacity: !ready || busy ? 0.6 : pressed ? 0.7 : 1 }]}
      >
        {busy === 'save' ? <ActivityIndicator color={theme.text} /> : <Ionicons name="download-outline" size={20} color={theme.text} />}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  preview: { alignSelf: 'center', borderRadius: 14, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, boxShadow: '0 12px 32px rgba(0,0,0,0.45)' },
  palettes: { gap: 14, paddingVertical: 2 },
  palette: { alignItems: 'center', gap: 4 },
  paletteRing: { borderWidth: 2.5, borderRadius: 26, padding: 2 },
  paletteSwatch: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  paletteDot: { width: 12, height: 12, borderRadius: 6 },
  paletteLabel: { fontFamily: fonts.monoBold, fontSize: 10, letterSpacing: 1 },
  buttons: { flexDirection: 'row', gap: 10 },
  primary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 52, borderRadius: 26 },
  primaryText: { fontFamily: fonts.monoBold, fontSize: font.body, letterSpacing: 1.5 },
  secondary: { width: 52, height: 52, borderRadius: 26, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
