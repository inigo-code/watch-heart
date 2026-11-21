import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';

import { Tap } from '@/components/Motion';
import { useTheme } from '@/lib/theme';

// Over a picture a bare white arrow disappears the moment the picture is bright, so every control that
// floats over one sits on this dark disc.
const DISC = 'rgba(0,0,0,0.5)';
const SIZE = 40;
// Android's top bar keeps its buttons 16dp in from the edges by itself; the web build's header doesn't,
// so there (the store screens) they get the same room.
const EDGE = Platform.OS === 'web' ? 16 : 0;
/** Room for a control at the right end of a page's top bar, matching the phone's own. */
export const headerEnd = { marginRight: EDGE };

type DiscProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  /** At the left end of the top bar (the way back) rather than the right. */
  start?: boolean;
  /** Over the page's plain ground: the icon alone in the text colour, no disc. */
  plain?: boolean;
};

/** A top-bar icon button: on a dark round backing over a picture, or plain over the page's ground. */
export function HeaderDisc({ icon, label, onPress, start, plain }: DiscProps) {
  const theme = useTheme();
  return (
    <Tap onPress={onPress} hitSlop={6} scale={0.92} accessibilityRole="button" accessibilityLabel={label} style={!start && headerEnd}>
      <View style={[styles.disc, !plain && styles.dark]}>
        <Ionicons name={icon} size={22} color={plain ? theme.text : '#FFFFFF'} />
      </View>
    </Tap>
  );
}

/** The way back: on a disc for pages whose top is a picture, plain on the rest. */
export function BackDisc({ plain }: { plain?: boolean }) {
  return (
    <View style={[styles.back, plain && styles.backPlain]}>
      <HeaderDisc start plain={plain} icon="arrow-back" label="Go back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Room between the disc and the page's title beside it.
  back: { marginRight: 14, marginLeft: EDGE },
  // A plain arrow sits a little further in than a disc, so its glyph lines up with the page's margin.
  backPlain: { marginLeft: EDGE - 8, marginRight: 8 },
  disc: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, alignItems: 'center', justifyContent: 'center' },
  dark: { backgroundColor: DISC },
});
