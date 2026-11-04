import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Tap } from '@/components/Motion';

// Over a picture a bare white arrow disappears the moment the picture is bright, so every control that
// floats over one sits on this dark disc.
const DISC = 'rgba(0,0,0,0.5)';
const SIZE = 40;

/** A dark round backing for an icon over a backdrop. */
export function HeaderDisc({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Tap onPress={onPress} hitSlop={6} scale={0.92} accessibilityRole="button" accessibilityLabel={label}>
      <View style={styles.disc}>
        <Ionicons name={icon} size={22} color="#FFFFFF" />
      </View>
    </Tap>
  );
}

/** The way back, for pages whose top is a picture or the page's own glow. */
export function BackDisc() {
  return <HeaderDisc icon="arrow-back" label="Go back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />;
}

const styles = StyleSheet.create({
  disc: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, backgroundColor: DISC, alignItems: 'center', justifyContent: 'center' },
});
