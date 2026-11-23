import { StyleSheet } from 'react-native';

import { Text } from '@/components/AppText';
import { fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';
import { useSettings } from '@/settings/SettingsProvider';

function hello(hour: number) {
  return hour < 5 ? 'Good evening' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}

/** The top of Home, under the header: a greeting with your first name, as on the website. */
export function Greeting({ theme }: { theme: Theme }) {
  const { settings } = useSettings();
  const name = settings.name.trim().split(/\s+/)[0];
  return (
    <Text maxFontSizeMultiplier={1.2} style={[styles.hello, { color: theme.text }]} accessibilityRole="header">
      {hello(new Date().getHours())}
      {name ? `, ${name}` : ''}
    </Text>
  );
}

const styles = StyleSheet.create({
  hello: { fontFamily: fonts.display, fontSize: 38, lineHeight: 40, letterSpacing: 0.5, includeFontPadding: false, textTransform: 'uppercase' },
});
