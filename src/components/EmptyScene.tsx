import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { CineIcon } from '@/components/CineIcon';
import type { CineIconName } from '@/components/CineIcon';
import { TicketPrint, TicketTear, ticketPaper } from '@/components/Diary';
import { Sprockets } from '@/components/Film';
import { font, fonts, shadow } from '@/lib/theme';
import type { Theme } from '@/lib/theme';

const ON_STRIP = 'rgba(244,239,230,0.07)';
const TICKET_W = 232;
const STRIP_W = 232;

/**
 * An empty page, drawn in the app's own world instead of an icon in a circle: a blank ticket waiting to be
 * printed (the Diary, lists) or a strip of empty frames (the Watchlist, Recap), then one line of what goes
 * here and, when there's something to do, one button for it.
 */
export function EmptyScene({ theme, scene, icon, title, text, action }: {
  theme: Theme;
  scene: 'ticket' | 'strip';
  /** The strip's middle frame shows this. */
  icon?: CineIconName;
  title: string;
  text: string;
  action?: { label: string; icon?: CineIconName; onPress: () => void };
}) {
  return (
    <View style={styles.wrap}>
      <View accessible={false} importantForAccessibility="no-hide-descendants" style={styles.scene}>
        {scene === 'ticket' ? <BlankTicket theme={theme} /> : <EmptyStrip theme={theme} icon={icon} />}
      </View>
      <Text style={[styles.title, { color: theme.text }]} accessibilityRole="header">
        {title}
      </Text>
      <Text style={[styles.text, { color: theme.textMuted }]}>{text}</Text>
      {action && (
        <Pressable
          onPress={action.onPress}
          accessibilityRole="button"
          style={({ pressed }) => [styles.button, { backgroundColor: theme.accent, opacity: pressed ? 0.85 : 1 }]}
        >
          {action.icon && <CineIcon name={action.icon} size={20} color={theme.accentText} />}
          <Text style={[styles.buttonText, { color: theme.accentText }]}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

/** A ticket with nothing printed on it yet: the stub says ADMIT ONE, the rest is blank lines. */
function BlankTicket({ theme }: { theme: Theme }) {
  const p = ticketPaper('movie', theme);
  // On Paper the ticket's own border is too close to the page; a soft ink keeps it a drawn object.
  const ink = theme.dark ? p.border : theme.textMuted + '59';
  return (
    <View style={[styles.ticket, { backgroundColor: p.paper, borderColor: ink }, !theme.dark && { borderWidth: 1, boxShadow: shadow.subtle }]}>
      <TicketPrint kind="movie" theme={theme} />
      <View style={styles.stub}>
        <Text style={[styles.admit, { color: theme.textMuted }]}>ADMIT</Text>
        <Text style={[styles.admit, { color: theme.textMuted }]}>ONE</Text>
      </View>
      <TicketTear theme={theme} border={ink} />
      <View style={[styles.posterSlot, { borderColor: ink }]} />
      <View style={styles.lines}>
        <View style={[styles.line, { width: '86%', backgroundColor: ink }]} />
        <View style={[styles.line, { width: '52%', backgroundColor: ink }]} />
        <View style={[styles.line, { width: '64%', backgroundColor: ink }]} />
      </View>
    </View>
  );
}

/** Three empty frames on a strip of film, the middle one lit with what goes here. */
function EmptyStrip({ theme, icon }: { theme: Theme; icon?: CineIconName }) {
  return (
    <View style={[styles.strip, { backgroundColor: theme.dark ? '#000000' : theme.text }]}>
      <Sprockets color={theme.dark ? theme.border : theme.bg} count={9} hole={5} />
      <View style={styles.frames}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.frame, { backgroundColor: ON_STRIP, borderColor: i === 1 ? theme.accentOnDark : 'transparent' }]}>
            {i === 1 && icon && <CineIcon name={icon} size={26} color={theme.accentOnDark} />}
          </View>
        ))}
      </View>
      <Sprockets color={theme.dark ? theme.border : theme.bg} count={9} hole={5} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 10, paddingTop: 48, paddingHorizontal: 28 },
  title: { fontFamily: fonts.uiBold, fontSize: font.title2, textAlign: 'center', marginTop: 14 },
  text: { fontFamily: fonts.ui, fontSize: font.body, textAlign: 'center', lineHeight: 21, maxWidth: 340 },
  button: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingHorizontal: 22, borderRadius: 24, marginTop: 10 },
  buttonText: { fontFamily: fonts.uiSemibold, fontSize: font.body },
  scene: { marginBottom: 8 },

  ticket: {
    flexDirection: 'row',
    alignItems: 'center',
    width: TICKET_W,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 7,
    paddingRight: 14,
    gap: 10,
    overflow: 'hidden',
    transform: [{ rotate: '-3deg' }],
  },
  stub: { width: 56, alignItems: 'center', paddingLeft: 6 },
  admit: { fontFamily: fonts.ticketBold, fontSize: 11, letterSpacing: 1 },
  posterSlot: { width: 34, height: 50, borderRadius: 3, borderWidth: 1.5 },
  lines: { flex: 1, gap: 8 },
  line: { height: 5, borderRadius: 3 },

  strip: { width: STRIP_W, borderRadius: 6, overflow: 'hidden', paddingHorizontal: 10 },
  frames: { flexDirection: 'row', gap: 8, paddingVertical: 6 },
  frame: { flex: 1, height: 84, borderRadius: 3, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
