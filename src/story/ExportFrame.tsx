import type { ReactNode, RefObject } from 'react';
import { PixelRatio, StyleSheet, View } from 'react-native';

import type { Theme } from '@/lib/theme';

import { PX_PER_POINT } from './export';
import type { StoryHandle } from './StoryCanvas';

/**
 * Shows a `w`×`h`-point image at `width`. `target` is the box that gets captured: exactly four pixels a
 * point on any phone, with the content scaled up inside it, so it's drawn sharp rather than stretched
 * (see StoryPreview, which does the same for stories).
 */
export function ExportFrame({ w, h, width, theme, target, children }: { w: number; h: number; width: number; theme: Theme; target: RefObject<StoryHandle | null>; children: ReactNode }) {
  const boxW = (w * PX_PER_POINT) / PixelRatio.get();
  const up = boxW / w;
  return (
    <View style={[styles.frame, { width, height: h * (width / w), borderColor: theme.border }]}>
      <View
        ref={target}
        collapsable={false}
        style={{ width: boxW, height: h * up, transform: [{ scale: width / boxW }], transformOrigin: 'top left', overflow: 'hidden' }}
      >
        <View style={{ width: w, height: h, transform: [{ scale: up }], transformOrigin: 'top left' }}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { alignSelf: 'center', borderRadius: 12, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
});
