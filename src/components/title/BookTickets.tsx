import Ionicons from '@expo/vector-icons/Ionicons';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ActionSheet } from '@/components/ActionSheet';
import { Text } from '@/components/AppText';
import { CineIcon } from '@/components/CineIcon';
import { SectionLabel } from '@/components/SectionLabel';
import { useToast } from '@/components/Toast';
import { font, fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';
import { TICKET_CITIES, bestSeatsUrl, bookMyShowUrl, ticketCityName } from '@/lib/tickets';
import { useSettings } from '@/settings/SettingsProvider';

/**
 * A film in cinemas in India: book it on BookMyShow in your city (its list of films showing there, where you
 * pick this one, a cinema, a show and seats), and where seats.movie covers the city, find the best seats.
 * The city is asked the first time and kept (Settings › Region and language).
 */
export function BookTickets({ title, theme }: { title: string; theme: Theme }) {
  const { settings, update } = useSettings();
  const toast = useToast();
  const [picking, setPicking] = useState(false);
  const city = ticketCityName(settings.ticketCity);
  const slug = city ? settings.ticketCity : null;
  const seats = slug ? bestSeatsUrl(slug) : null;

  const open = (url: string) => Linking.openURL(url).catch(() => toast('Couldn’t open that page. Try again in a moment.'));

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <SectionLabel theme={theme} style={styles.label}>
          {city ? `Book tickets in ${city}` : 'Book tickets'}
        </SectionLabel>
        {city && (
          <Pressable onPress={() => setPicking(true)} accessibilityRole="button" accessibilityLabel={`Change city, now ${city}`} hitSlop={8} style={styles.change}>
            <Text style={[styles.changeText, { color: theme.accent }]}>Change city</Text>
          </Pressable>
        )}
      </View>

      {slug ? (
        <>
          <View style={styles.buttons}>
            <Button theme={theme} primary icon={<CineIcon name="diary" size={18} color={theme.accentText} />} label="BookMyShow" hint={`Book ${title} on BookMyShow in ${city}`} onPress={() => open(bookMyShowUrl(slug))} />
            {seats && (
              <Button theme={theme} icon={<Ionicons name="grid-outline" size={16} color={theme.text} />} label="Best seats" hint={`Find the best seats in ${city} on seats.movie`} onPress={() => open(seats)} />
            )}
          </View>
          <Text style={[styles.note, { color: theme.textMuted }]}>
            Opens the films showing in {city}: pick {title}, then a cinema, a show and your seats.
          </Text>
        </>
      ) : (
        <Button theme={theme} primary icon={<Ionicons name="location-outline" size={17} color={theme.accentText} />} label="Choose your city" onPress={() => setPicking(true)} />
      )}

      <ActionSheet
        visible={picking}
        title="Your city, for cinema tickets"
        onClose={() => setPicking(false)}
        actions={TICKET_CITIES.map((c) => ({
          label: `${c.name}${c.slug === settings.ticketCity ? '  ✓' : ''}`,
          onPress: () => update({ ticketCity: c.slug }),
        }))}
      />
    </View>
  );
}

function Button({ theme, primary, icon, label, hint, onPress }: { theme: Theme; primary?: boolean; icon: ReactNode; label: string; hint?: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={hint ? 'link' : 'button'}
      accessibilityLabel={hint ?? label}
      style={({ pressed }) => [
        styles.button,
        primary
          ? { backgroundColor: theme.accent, opacity: pressed ? 0.85 : 1 }
          : { backgroundColor: pressed ? theme.chip : 'transparent', borderColor: theme.border, borderWidth: 1 },
      ]}
    >
      {icon}
      <Text style={[styles.buttonText, { color: primary ? theme.accentText : theme.text }]}>{label}</Text>
      {hint && <Ionicons name="open-outline" size={13} color={primary ? theme.accentText : theme.textMuted} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  label: { flex: 1 },
  change: { paddingVertical: 4 },
  changeText: { fontFamily: fonts.uiSemibold, fontSize: font.caption },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 46, borderRadius: 23, paddingHorizontal: 18, alignSelf: 'flex-start' },
  buttonText: { fontFamily: fonts.uiSemibold, fontSize: font.footnote },
  note: { fontFamily: fonts.ui, fontSize: font.caption, lineHeight: 17 },
});
