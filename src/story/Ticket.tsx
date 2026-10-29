// React Native's Image, not expo-image: see StoryCanvas (captured images must be drawn synchronously).
import { Image, StyleSheet, Text, View } from 'react-native';

import { deviceLabel } from '@/lib/viewing';
import { plainText } from '@/lib/richText';
import { fonts } from '@/lib/theme';
import type { TicketLook } from '@/settings/SettingsProvider';
import type { Entry } from '@/store/types';

import { sharp } from './export';

/**
 * A viewing as an Indian cinema ticket, in one of three looks, drawn at 400 points wide on a dark table so
 * torn edges and notches read in the saved image. The details a diary doesn't keep (serial, seat, show,
 * price) are made up once from the entry's id, so a ticket always prints the same.
 */
export const TICKET_W = 400;
export const TICKET_H: Record<TicketLook, number> = { talkies: 214, thermal: 292, fdfs: 176 };
export const TICKET_LOOKS: { key: TicketLook; label: string }[] = [
  { key: 'talkies', label: 'Talkies' },
  { key: 'thermal', label: 'Multiplex' },
  { key: 'fdfs', label: 'FDFS' },
];

const TABLE = '#0B0A0D';
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const SHOWS = ['NOON SHOW · 12:00 PM', 'MATINEE · 3:00 PM', '1ST SHOW · 6:15 PM', '2ND SHOW · 9:30 PM'];

/** A small, steady hash: the same entry always gets the same serial and seat. */
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** What the ticket prints, from the entry (and its release date, for the FDFS stamp). */
export function ticketFacts(e: Entry, released: string | null) {
  const h = hash(e.id);
  const [y, m, d] = e.watchedOn.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const cinema = e.device === 'cinema';
  const people = Math.min(6, 1 + (e.companions?.length ?? 0));
  const row = 'ABCDEFGHJK'[h % 10];
  const first = 5 + ((h >> 4) % 15);
  const daysAfter = released ? Math.round((date.getTime() - new Date(`${released}T00:00:00`).getTime()) / 86400000) : null;
  const fdfs = e.kind === 'movie' && daysAfter !== null && daysAfter >= 0 && daysAfter <= 3;
  return {
    serial: String(h % 1000000).padStart(6, '0'),
    booking: `WH${(hash(`${e.id}:b`) % 60466176).toString(36).toUpperCase().padStart(5, '0')}`,
    date: e.undated ? 'DATE UNKNOWN' : `${DAYS[date.getDay()]} ${d} ${MONTHS[m - 1]} ${y}`,
    dateShort: e.undated ? '—' : `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${String(y).slice(2)}`,
    show: SHOWS[(h >> 8) % SHOWS.length],
    seats: Array.from({ length: people }, (_, i) => `${row}-${first + i}`),
    people,
    with: (e.companions ?? []).join(', ').toUpperCase(),
    cinema,
    // Where it played: a hall at the cinema, else the service or the screen.
    screen: cinema ? `AUDI 0${1 + ((h >> 12) % 6)}` : (e.platform || deviceLabel(e.device) || 'HOME').toUpperCase(),
    hall: cinema ? ['BALCONY', 'FIRST CLASS', 'DRESS CIRCLE'][(h >> 16) % 3] : 'HOME THEATRE',
    hallShort: cinema ? ['BALC.', '1ST CL.', 'D. CIRCLE'][(h >> 16) % 3] : 'HOME',
    price: cinema ? `₹ ${[120, 150, 180, 200][(h >> 20) % 4]}.00` : null,
    stars: e.rating ? '★'.repeat(Math.floor(e.rating / 2)) + (e.rating % 2 ? '½' : '') : '',
    review: e.review && !e.spoilers ? plainText(e.review).replace(/\s+/g, ' ').trim() : '',
    // The FDFS look's stamp tells the truth: first day first show only when you were there in the first days.
    stamp: fdfs ? 'FIRST DAY\nFIRST SHOW' : e.rewatch ? 'REPEAT\nSHOW' : e.liked ? 'HOUSE\nFULL' : 'ADMIT\nONE',
  };
}

type Props = { entry: Entry; look: TicketLook; released: string | null; onPoster?: () => void };

export function Ticket({ entry, look, released, onPoster }: Props) {
  const f = ticketFacts(entry, released);
  return (
    <View style={[styles.table, { height: TICKET_H[look] }]} collapsable={false}>
      {look === 'talkies' && <Talkies e={entry} f={f} />}
      {look === 'thermal' && <Thermal e={entry} f={f} onPoster={onPoster} />}
      {look === 'fdfs' && <Fdfs e={entry} f={f} />}
    </View>
  );
}

type Facts = ReturnType<typeof ticketFacts>;
const title = (e: Entry) => e.title.toUpperCase();

// --- A: the single-screen talkies ticket ---------------------------------------------------------------

const PINK = '#F4C3CC';
const MAROON = '#7E1530';
const DARK_MAROON = '#3A0A18';
const RED = '#C0122E';
const INK = 'rgba(30, 55, 160, 0.82)';

function Talkies({ e, f }: { e: Entry; f: Facts }) {
  return (
    <View style={[styles.paper, { width: 360, height: 174, backgroundColor: PINK, flexDirection: 'row' }]}>
      {/* Engraved rings, like the security print on old tickets. */}
      <View style={styles.rings} pointerEvents="none">
        {Array.from({ length: 16 }, (_, i) => (
          <View key={i} style={[styles.ring, { width: 30 + i * 28, height: 30 + i * 28, borderRadius: 15 + i * 14 }]} />
        ))}
      </View>
      <View style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 9 }}>
        <View style={styles.between}>
          <Text style={[styles.mono, { color: MAROON, fontSize: 8 }]}>
            No. <Text style={{ color: RED, fontFamily: fonts.monoBold, fontSize: 10 }}>{f.serial}</Text>
          </Text>
          <Text style={[styles.mono, { color: MAROON, fontSize: 8 }]}>ADMIT {f.people === 1 ? 'ONE' : f.people}</Text>
        </View>
        <Text style={[styles.display, { color: MAROON, fontSize: 23, letterSpacing: 2, textAlign: 'center', marginTop: 1 }]}>WATCH HEART TALKIES</Text>
        <Text style={[styles.monoBold, { color: MAROON, fontSize: 7.5, letterSpacing: 2.5, textAlign: 'center' }]}>— {f.hall} —</Text>
        <Text style={[styles.display, { color: DARK_MAROON, fontSize: 18, letterSpacing: 1.5, textAlign: 'center', marginTop: 3 }]} numberOfLines={1}>
          {title(e)}
        </Text>
        {!!e.progress && <Text style={[styles.mono, { color: MAROON, fontSize: 7.5, textAlign: 'center' }]}>{e.progress.toUpperCase()}</Text>}
        <View style={[styles.between, styles.grid, { borderColor: MAROON }]}>
          <Cell k="DATE" v={f.date} color={MAROON} strong={DARK_MAROON} />
          <Cell k="SHOW" v={f.cinema ? f.show : f.screen} color={MAROON} strong={DARK_MAROON} />
          <Cell k={f.people > 1 ? 'SEATS' : 'SEAT'} v={f.seats.length > 2 ? `${f.seats[0]} +${f.seats.length - 1}` : f.seats.join(', ')} color={MAROON} strong={DARK_MAROON} />
        </View>
        {(!!f.with || f.cinema) && (
          <Text style={[styles.mono, { color: MAROON, fontSize: 6.5, letterSpacing: 0.5, marginTop: 5 }]} numberOfLines={1}>
            {[f.with && `WITH ${f.with}`, f.cinema && 'CINEMA', f.price && `${f.price} INCL. TAX`].filter(Boolean).join(' · ')}
          </Text>
        )}
      </View>
      <Perforation color="rgba(126, 21, 48, 0.55)" />
      <View style={{ width: 66, alignItems: 'center', paddingTop: 10, gap: 5 }}>
        <Text style={[styles.display, { color: MAROON, fontSize: 14, letterSpacing: 2 }]}>CONTROL</Text>
        <Text style={[styles.monoBold, { color: RED, fontSize: 11, letterSpacing: 1 }]}>{f.serial}</Text>
        <Text style={[styles.mono, { color: MAROON, fontSize: 7.5 }]}>{f.dateShort}</Text>
        <Text style={[styles.mono, { color: MAROON, fontSize: 7.5 }]}>{f.seats[0]}</Text>
        <Text style={[styles.mono, { color: MAROON, fontSize: 7.5 }]}>{f.hallShort}</Text>
      </View>
      {/* The rubber stamp: your stars and heart. */}
      <View style={[styles.stamp, { borderColor: INK }]}>
        <View style={[styles.stampInner, { borderColor: INK }]}>
          {!!f.stars && <Text style={[styles.mono, { color: INK, fontSize: 8 }]}>{f.stars}</Text>}
          <Text style={[styles.display, { color: INK, fontSize: 11.5, letterSpacing: 0.8 }]} numberOfLines={1}>
            {e.liked ? '♥ LOVED IT' : e.rewatch ? 'AGAIN' : 'SEEN'}
          </Text>
          <Text style={[styles.mono, { color: INK, fontSize: 6.5 }]}>{f.dateShort}</Text>
        </View>
      </View>
    </View>
  );
}

function Cell({ k, v, color, strong }: { k: string; v: string; color: string; strong: string }) {
  return (
    <View style={{ gap: 1, flexShrink: 1 }}>
      <Text style={[styles.mono, { color, fontSize: 5.5, letterSpacing: 1.2 }]}>{k}</Text>
      <Text style={[styles.monoBold, { color: strong, fontSize: 8 }]} numberOfLines={1}>
        {v}
      </Text>
    </View>
  );
}

/** The dashed tear line between ticket and stub, with a notch at each end. */
function Perforation({ color }: { color: string }) {
  return (
    <View style={{ width: 2, alignItems: 'center' }}>
      <View style={[styles.notch, { top: -6 }]} />
      <View style={{ flex: 1, justifyContent: 'space-evenly', paddingVertical: 8 }}>
        {Array.from({ length: 16 }, (_, i) => (
          <View key={i} style={{ width: 1.2, height: 4, backgroundColor: color }} />
        ))}
      </View>
      <View style={[styles.notch, { bottom: -6 }]} />
    </View>
  );
}

// --- B: the multiplex thermal print --------------------------------------------------------------------

const CREAM = '#F3EFE6';
const THERMAL = '#2B2A28';
const FADED = '#55524D';

function Thermal({ e, f, onPoster }: { e: Entry; f: Facts; onPoster?: () => void }) {
  return (
    <View style={[styles.paper, { width: 360, backgroundColor: CREAM, borderRadius: 0, paddingHorizontal: 15, paddingVertical: 14 }]}>
      <Zigzag edge="top" />
      <View style={styles.between}>
        <Text style={[styles.monoBold, { color: THERMAL, fontSize: 11.5, letterSpacing: 1.6 }]}>WATCH HEART CINEMAS</Text>
        <Text style={[styles.mono, styles.mticket, { color: THERMAL, borderColor: THERMAL }]}>M-TICKET</Text>
      </View>
      <Rule />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={styles.thermalPoster}>
          {e.posterUrl ? (
            <Image
              source={{ uri: sharp(e.posterUrl, 48) }}
              style={[StyleSheet.absoluteFill, { filter: 'grayscale(1) contrast(1.5)' }]}
              resizeMode="cover"
              resizeMethod="scale"
              onLoadEnd={onPoster}
              onError={onPoster}
            />
          ) : null}
          {/* Thermal paper prints pale: the poster sits under a wash of the paper. */}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: CREAM, opacity: 0.18 }]} />
        </View>
        <View style={{ flex: 1, gap: 2.5 }}>
          <Text style={[styles.display, { color: THERMAL, fontSize: 20, letterSpacing: 1, lineHeight: 21 }]} numberOfLines={2}>
            {title(e)}
          </Text>
          <Text style={[styles.mono, { color: FADED, fontSize: 7 }]} numberOfLines={1}>
            {[e.year, e.progress?.toUpperCase()].filter(Boolean).join(' · ')}
          </Text>
          {!!e.credit && (
            <Text style={[styles.mono, { color: FADED, fontSize: 7 }]} numberOfLines={1}>
              {e.kind === 'movie' ? 'DIR. ' : ''}
              {e.credit.toUpperCase()}
            </Text>
          )}
          <View style={styles.between}>
            <Text style={[styles.mono, styles.kv]}>{f.date}</Text>
            {f.cinema && <Text style={[styles.mono, styles.kv]}>{f.show.split(' · ')[1]}</Text>}
          </View>
          <View style={styles.between}>
            <Text style={[styles.mono, styles.kv]}>{f.screen}</Text>
            <Text style={[styles.mono, styles.kv]}>
              {f.people} TICKET{f.people > 1 ? 'S' : ''}
            </Text>
          </View>
          <Text style={[styles.monoBold, { color: THERMAL, fontSize: 10, letterSpacing: 1 }]} numberOfLines={1}>
            SEAT{f.people > 1 ? 'S' : ''} {f.seats.join(', ')}
          </Text>
        </View>
      </View>
      <Rule />
      <View style={styles.between}>
        <Text style={[styles.monoBold, { color: THERMAL, fontSize: 9 }]}>YOUR RATING</Text>
        <Text style={[styles.monoBold, { color: THERMAL, fontSize: 9.5 }]}>
          {f.stars || 'NO RATING'} {e.liked ? '♥' : ''}
        </Text>
      </View>
      {!!f.with && (
        <View style={styles.between}>
          <Text style={[styles.mono, styles.kv]}>WITH</Text>
          <Text style={[styles.mono, styles.kv]} numberOfLines={1}>
            {f.with}
          </Text>
        </View>
      )}
      {!!f.review && (
        <Text style={[styles.mono, { color: '#4A4743', fontSize: 7.5, fontStyle: 'italic', marginTop: 3 }]} numberOfLines={2}>
          “{f.review}”
        </Text>
      )}
      <Rule />
      <View style={[styles.between, { alignItems: 'center' }]}>
        <Barcode seed={f.serial} />
        <Qr seed={f.booking} />
      </View>
      <View style={[styles.between, { marginTop: 5 }]}>
        <Text style={[styles.mono, { color: FADED, fontSize: 6.2, letterSpacing: 0.6 }]}>BOOKING ID {f.booking}</Text>
        <Text style={[styles.mono, { color: FADED, fontSize: 6.2, letterSpacing: 0.6 }]}>THANK YOU · ENJOY THE SHOW</Text>
      </View>
      <Zigzag edge="bottom" />
    </View>
  );
}

function Rule() {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 7 }}>
      {Array.from({ length: 44 }, (_, i) => (
        <View key={i} style={{ width: 4, height: 1.2, backgroundColor: '#6B6862' }} />
      ))}
    </View>
  );
}

/** The torn-off edge of a receipt: a row of teeth in the table's colour. */
function Zigzag({ edge }: { edge: 'top' | 'bottom' }) {
  return (
    <View style={[styles.zigzag, edge === 'top' ? { top: -5 } : { bottom: -5 }]} pointerEvents="none">
      {Array.from({ length: 41 }, (_, i) => (
        <View key={i} style={styles.tooth} />
      ))}
    </View>
  );
}

function Barcode({ seed }: { seed: string }) {
  const h = hash(seed);
  return (
    <View style={{ flexDirection: 'row', height: 30 }}>
      {Array.from({ length: 52 }, (_, i) => (
        <View key={i} style={{ width: [0.6, 1.2, 1.8, 0.6, 1.2][(i * 7 + h) % 5], marginRight: [0.6, 1.2, 0.6, 1.8][(i * 3 + (h >> 3)) % 4], backgroundColor: THERMAL }} />
      ))}
    </View>
  );
}

/** A QR-looking square (decoration: it encodes nothing), drawn as runs so it stays a few dozen views. */
function Qr({ seed }: { seed: string }) {
  const h = hash(seed);
  const N = 21;
  const C = 1.7;
  const finder = (x: number, y: number) =>
    [
      [0, 0],
      [14, 0],
      [0, 14],
    ].some(([fx, fy]) => {
      if (x < fx || x >= fx + 7 || y < fy || y >= fy + 7) return false;
      const dx = x - fx;
      const dy = y - fy;
      return dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4);
    });
  const inFinder = (x: number, y: number) => (x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12);
  const runs: { x: number; y: number; w: number }[] = [];
  for (let y = 0; y < N; y++) {
    let start = -1;
    for (let x = 0; x <= N; x++) {
      const on = x < N && (inFinder(x, y) ? finder(x, y) : ((x * 31 + y * 17 + x * y + h) % 7) < 3);
      if (on && start < 0) start = x;
      if (!on && start >= 0) {
        runs.push({ x: start, y, w: x - start });
        start = -1;
      }
    }
  }
  return (
    <View style={{ width: N * C, height: N * C }}>
      {runs.map((r, i) => (
        <View key={i} style={{ position: 'absolute', left: r.x * C, top: r.y * C, width: r.w * C, height: C, backgroundColor: THERMAL }} />
      ))}
    </View>
  );
}

// --- C: the FDFS fan ticket ----------------------------------------------------------------------------

const YELLOW = '#F2D34E';
const BLUE = '#1F3A93';
const NAVY = '#0E1F5C';
const STAMP_RED = 'rgba(200, 20, 30, 0.88)';

function Fdfs({ e, f }: { e: Entry; f: Facts }) {
  return (
    <View style={[styles.paper, { width: 360, height: 136, backgroundColor: YELLOW, borderRadius: 0, paddingLeft: 24, paddingRight: 14, paddingVertical: 9 }]}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {Array.from({ length: 28 }, (_, i) => (
          <View key={i} style={{ position: 'absolute', left: 0, right: 0, top: 3 + i * 6, height: 0.6, backgroundColor: 'rgba(31, 58, 147, 0.13)' }} />
        ))}
      </View>
      <TornEdge />
      <View style={styles.between}>
        <Text style={[styles.monoBold, { color: BLUE, fontSize: 8, letterSpacing: 1.2 }]}>GATE {1 + (hash(e.id) % 4)}</Text>
        <Text style={[styles.monoBold, { color: '#B3141C', fontSize: 10, letterSpacing: 1.2 }]}>Nº {f.serial}</Text>
      </View>
      <Text style={[styles.display, { color: BLUE, fontSize: 27, letterSpacing: 3.5, lineHeight: 28 }]}>WATCH HEART</Text>
      <Text style={[styles.monoBold, { color: BLUE, fontSize: 6.3, letterSpacing: 1.2 }]}>
        {f.cinema ? 'CINEMA · SINGLE SCREEN · FRONT STALL' : `HOME SCREEN · ${f.screen}`}
      </Text>
      <Text style={[styles.display, { color: NAVY, fontSize: 21, letterSpacing: 1.6, marginTop: 4, maxWidth: 210 }]} numberOfLines={1}>
        {title(e)}
      </Text>
      <View style={[styles.between, { borderTopWidth: 0.9, borderColor: BLUE, paddingTop: 3, marginTop: 3 }]}>
        <Text style={[styles.monoBold, { color: BLUE, fontSize: 8 }]}>{f.date}</Text>
        {f.cinema && <Text style={[styles.monoBold, { color: BLUE, fontSize: 8 }]}>{f.show}</Text>}
        <Text style={[styles.monoBold, { color: BLUE, fontSize: 8 }]} numberOfLines={1}>
          SEAT {f.seats.length > 2 ? `${f.seats[0]} +${f.seats.length - 1}` : f.seats.join(' · ')}
        </Text>
      </View>
      <View style={[styles.between, { marginTop: 3 }]}>
        <Text style={[styles.mono, { color: BLUE, fontSize: 7.5 }]} numberOfLines={1}>
          {f.with ? `WITH ${f.with}` : e.progress ? e.progress.toUpperCase() : ' '}
        </Text>
        <Text style={[styles.mono, { color: BLUE, fontSize: 8 }]}>
          {f.stars} {e.liked ? '♥' : ''}
        </Text>
      </View>
      <Text style={[styles.mono, { color: BLUE, fontSize: 5.8, letterSpacing: 1.7, opacity: 0.75, marginTop: 6 }]}>FANS SHOW · WHISTLES ALLOWED</Text>
      <View style={[styles.fdfsStamp, { borderColor: STAMP_RED }]}>
        <Text style={[styles.display, { color: STAMP_RED, fontSize: 17, letterSpacing: 1.6, lineHeight: 16, textAlign: 'center' }]}>{f.stamp}</Text>
      </View>
    </View>
  );
}

/** The hand-torn left edge: jagged bites in the table's colour. */
function TornEdge() {
  const bites = [5, 2, 6, 3, 7, 2, 5, 3, 6, 2, 4, 6, 3, 5, 2];
  return (
    <View style={{ position: 'absolute', left: -7, top: 0, bottom: 0, width: 14 }} pointerEvents="none">
      {bites.map((b, i) => (
        <View key={i} style={{ position: 'absolute', left: b - 6, top: i * 11.5 - 4, width: 11, height: 11, backgroundColor: TABLE, transform: [{ rotate: '45deg' }] }} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  table: { width: TICKET_W, backgroundColor: TABLE, alignItems: 'center', justifyContent: 'center' },
  paper: { borderRadius: 4, overflow: 'hidden' },
  display: { fontFamily: fonts.display },
  mono: { fontFamily: fonts.mono },
  monoBold: { fontFamily: fonts.monoBold },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 6 },
  rings: { position: 'absolute', left: 0, right: 0, bottom: -60, alignItems: 'center', justifyContent: 'center', height: 440, opacity: 0.16 },
  ring: { position: 'absolute', borderWidth: 0.6, borderColor: MAROON },
  grid: { marginTop: 6, borderTopWidth: 0.9, borderBottomWidth: 0.9, paddingVertical: 3.5 },
  stamp: { position: 'absolute', right: 10, bottom: 8, width: 62, height: 62, borderRadius: 31, borderWidth: 1.2, padding: 2, transform: [{ rotate: '-14deg' }] },
  stampInner: { flex: 1, borderRadius: 29, borderWidth: 0.8, alignItems: 'center', justifyContent: 'center' },
  notch: { position: 'absolute', left: -6, width: 13, height: 13, borderRadius: 7, backgroundColor: TABLE, zIndex: 1 },
  mticket: { fontSize: 7, letterSpacing: 1.2, borderWidth: 0.9, paddingHorizontal: 4, paddingVertical: 1 },
  thermalPoster: { width: 48, height: 72, backgroundColor: '#D9D4C8', overflow: 'hidden' },
  kv: { color: THERMAL, fontSize: 8, letterSpacing: 0.6 },
  zigzag: { position: 'absolute', left: -2, right: -2, height: 10, flexDirection: 'row', justifyContent: 'space-between', zIndex: 2 },
  tooth: { width: 7, height: 7, backgroundColor: TABLE, transform: [{ rotate: '45deg' }], marginTop: 1.5 },
  fdfsStamp: { position: 'absolute', right: 16, top: 34, borderWidth: 2.2, borderRadius: 2, paddingHorizontal: 7, paddingVertical: 5, transform: [{ rotate: '-12deg' }] },
});
