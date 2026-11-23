import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { PaperTicket, Reel, showTime } from '@/components/Reel';
import { useHaptic } from '@/lib/haptics';
import { fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';
import { useSettings } from '@/settings/SettingsProvider';

const REEL = 74;

function hello(hour: number) {
  return hour < 5 ? 'Good evening' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}

/**
 * The top of Home, under the header: a greeting with your name, and Reel holding up a ticket with what's on at
 * this hour (MORNING SHOW, MATINEE, EVENING SHOW, LATE SHOW), as on the website. A tap spins him once.
 */
export function Greeting({ theme }: { theme: Theme }) {
  const { settings } = useSettings();
  const haptic = useHaptic();
  const [spins, setSpins] = useState(0);
  const hour = new Date().getHours();
  const name = settings.name.trim().split(/\s+/)[0];
  return (
    <View style={styles.row}>
      <Text maxFontSizeMultiplier={1.2} style={[styles.hello, { color: theme.text }]} accessibilityRole="header">
        {hello(hour)}
        {name ? `, ${name}` : ''}
      </Text>
      <Pressable
        onPress={() => {
          haptic('step');
          setSpins((n) => n + 1);
        }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.reel}
      >
        <Reel size={REEL} spins={spins} />
        <PaperTicket text={showTime(hour)} hole={theme.bg} size={9} tilt={-4} style={styles.ticket} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: -12, marginBottom: -8 },
  hello: { flex: 1, fontFamily: fonts.display, fontSize: 38, lineHeight: 40, letterSpacing: 0.5, includeFontPadding: false, textTransform: 'uppercase' },
  reel: { width: REEL + 50, alignItems: 'center', paddingBottom: 14 },
  ticket: { position: 'absolute', bottom: 2 },
});
