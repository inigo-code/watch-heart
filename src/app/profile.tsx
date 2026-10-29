import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardSafe } from '@/components/KeyboardSafe';
import { Poster } from '@/components/Film';
import { ListCover } from '@/components/lists/ListCover';
import { RatingChart } from '@/components/RatingChart';
import { Face } from '@/components/title/Rows';
import { useFriends } from '@/friends/FriendsProvider';
import { SectionLabel } from '@/components/SectionLabel';
import { Achievements } from '@/components/profile/Achievements';
import { ActivityGraph, ActivityKey } from '@/components/profile/ActivityGraph';
import { FavouritePicker } from '@/components/profile/FavouritePicker';
import { useToast } from '@/components/Toast';
import { MONTHS, friendlyDate, today } from '@/lib/dates';
import { needsShrinking, pickProfilePhoto, removePhotoFile, squareJpeg } from '@/lib/profilePhoto';
import { profileStats } from '@/lib/profileStats';
import { KIND_LABEL } from '@/lib/stats';
import { font, fonts, kindColor, useTheme } from '@/lib/theme';
import { deviceLabel } from '@/lib/viewing';
import type { Theme } from '@/lib/theme';
import { useSettings } from '@/settings/SettingsProvider';
import type { Favourite } from '@/settings/SettingsProvider';
import { useDiary } from '@/store/DiaryStore';
import { useLists } from '@/lists/ListsProvider';
import { useSync } from '@/sync/SyncProvider';

const GOALS = [25, 52, 100, 150, 365];

/** You: photo, name and a line, your favourite four, and everything your diary adds up to. */
/** Waits for saved settings, so the name and bio drafts start from them, not from empty defaults. */
export default function ProfileScreen() {
  const theme = useTheme();
  const { ready } = useSettings();
  if (!ready) return <View style={{ flex: 1, backgroundColor: theme.bg }} />;
  return <ProfileBody />;
}

function ProfileBody() {
  const friends = useFriends();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { settings, update } = useSettings();
  const sync = useSync();

  // Name and bio are drafts until you save (or leave the screen, which saves them too).
  const [name, setName] = useState(settings.name);
  const [bio, setBio] = useState(settings.bio);
  const dirty = name.trim() !== settings.name || bio.trim() !== settings.bio;
  const draft = useRef({ name, bio, dirty, settings });
  useEffect(() => {
    draft.current = { name, bio, dirty, settings };
  });
  const saveText = (quiet = false) => {
    const d = draft.current;
    if (!d.dirty) return;
    update({ name: d.name.trim(), bio: d.bio.trim() });
    if (quiet) return;
    Keyboard.dismiss();
    toast(sync.email ? 'Profile saved · syncing to your account' : 'Profile saved');
  };
  // Leaving the screen keeps what you typed. (The draft is read from the ref, so this runs once, on leaving.)
  const saveOnLeave = useRef(saveText);
  useEffect(() => {
    saveOnLeave.current = saveText;
  });
  useEffect(() => () => saveOnLeave.current(true), []);
  const { entries } = useDiary();
  const { lists } = useLists();
  const [picking, setPicking] = useState<number | null>(null);
  const [busyPhoto, setBusyPhoto] = useState(false);
  const todayIso = today();
  const s = useMemo(() => profileStats(entries, todayIso), [entries, todayIso]);
  const year = todayIso.slice(0, 4);

  /** A new photo: picked, cropped square and made small; it goes up with the next sync. */
  const setPhoto = (uri: string) => {
    const old = settings.photo;
    update({ photo: uri, photoPath: null });
    if (old !== uri) removePhotoFile(old);
  };
  const choosePhoto = async () => {
    try {
      setBusyPhoto(true);
      const uri = await pickProfilePhoto();
      if (uri) setPhoto(uri);
    } catch (e) {
      toast(`Couldn’t use that picture: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusyPhoto(false);
    }
  };

  // A big photo saved before photos were made small (too big to sync): made small once, quietly.
  const fixedOld = useRef(false);
  useEffect(() => {
    if (fixedOld.current || Platform.OS === 'web' || settings.photoPath || !needsShrinking(settings.photo)) return;
    fixedOld.current = true;
    squareJpeg(settings.photo!).then(setPhoto, () => {});
  });

  const setFavourite = (slot: number, f: Favourite | null) => {
    const next = [...settings.favourites];
    if (f) {
      // A title can only hold one slot.
      const dupe = next.findIndex((x, i) => i !== slot && x && x.sourceId === f.sourceId && x.title === f.title);
      if (dupe >= 0) next.splice(dupe, 1);
      next[slot] = f;
    } else next.splice(slot, 1);
    update({ favourites: next.filter(Boolean).slice(0, 4) });
  };

  const goal = settings.yearGoal;
  const pct = goal ? Math.min(1, s.thisYear / goal) : 0;
  const dayOfYear = Math.floor((Date.parse(todayIso) - Date.parse(`${year}-01-01`)) / 86400000) + 1;
  const onPace = goal ? Math.round((goal * dayOfYear) / 365) : 0;

  return (
    <KeyboardSafe style={{ backgroundColor: theme.bg }}>
      <ScrollView
        style={{ backgroundColor: theme.bg }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Who */}
        <View style={styles.who}>
          <Pressable
            onPress={choosePhoto}
            accessibilityRole="button"
            accessibilityLabel="Change your photo"
            style={[styles.photoRing, { borderColor: theme.accent }]}
          >
            {settings.photo ? (
              <Image source={settings.photo} style={styles.photo} contentFit="cover" />
            ) : (
              <Text style={[styles.initial, { color: theme.text }]}>{(settings.name.trim()[0] ?? '♥').toUpperCase()}</Text>
            )}
            <View style={[styles.camera, { backgroundColor: theme.accent }]}>
              {busyPhoto ? <ActivityIndicator size="small" color={theme.accentText} /> : <Ionicons name="camera" size={14} color={theme.accentText} />}
            </View>
          </Pressable>
          <TextInput
            value={name}
            onChangeText={setName}
            onSubmitEditing={() => saveText()}
            returnKeyType="done"
            placeholder="YOUR NAME"
            placeholderTextColor={theme.textMuted}
            style={[styles.name, { color: theme.text }]}
            maxLength={30}
            textAlign="center"
          />
          <TextInput
            value={bio}
            onChangeText={setBio}
            placeholder="A line about you, e.g. Ghibli first, horror second"
            placeholderTextColor={theme.textMuted}
            style={[styles.bio, { color: theme.textMuted }]}
            maxLength={90}
            multiline
            textAlign="center"
          />
          {dirty && (
            <Pressable
              onPress={() => saveText()}
              accessibilityRole="button"
              style={({ pressed }) => [styles.save, { backgroundColor: theme.accent, opacity: pressed ? 0.85 : 1 }]}
            >
              <Ionicons name="checkmark" size={18} color={theme.accentText} />
              <Text style={[styles.saveText, { color: theme.accentText }]}>SAVE</Text>
            </Pressable>
          )}
        </View>

        {/* Favourite four */}
        <Block theme={theme} title="Favourite four">
          <View style={styles.favs}>
            {[0, 1, 2, 3].map((i) => {
              const f = settings.favourites[i];
              return (
                <Pressable
                  key={i}
                  onPress={() => setPicking(f || i <= settings.favourites.length ? Math.min(i, settings.favourites.length) : settings.favourites.length)}
                  onLongPress={() => f && setFavourite(i, null)}
                  accessibilityRole="button"
                  accessibilityLabel={f ? `${f.title}. Tap to change, hold to remove` : 'Add a favourite'}
                  style={styles.fav}
                >
                  {f ? (
                    <Poster uri={f.posterUrl} title={f.title} width={74} theme={theme} radius={6} />
                  ) : (
                    <View style={[styles.emptyFav, { borderColor: theme.border }]}>
                      <Ionicons name="add" size={26} color={theme.textMuted} />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.hint, { color: theme.textMuted }]}>Tap to choose from your diary. Hold one to remove it.</Text>
        </Block>

        {/* The numbers */}
        <View style={styles.numbers}>
          {(['movie', 'tv', 'anime'] as const).map((k) => (
            <Count
              key={k}
              theme={theme}
              value={s.titles[k]}
              label={KIND_LABEL[k] === 'Film' ? 'FILMS' : KIND_LABEL[k].toUpperCase()}
              color={kindColor(k, theme)}
            />
          ))}
          <Count theme={theme} value={s.hours} label="HOURS" color={theme.accent} />
        </View>
        <View style={[styles.facts, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Fact theme={theme} icon="albums-outline" text={`${s.viewings} viewings logged`} />
          <Fact theme={theme} icon="tv-outline" text={`${s.episodes} episodes of series and anime`} />
          <Fact theme={theme} icon="star-outline" text={s.avgStars ? `${s.avgStars} stars on average` : 'No ratings yet'} />
          <Fact theme={theme} icon="heart-outline" text={`${s.loved} loved · ${s.reviews} reviews`} />
          {s.binge && s.binge.episodes >= 3 && (
            <Fact theme={theme} icon="flash-outline" text={`Longest binge: ${s.binge.episodes} on ${friendlyDate(s.binge.date)}`} />
          )}
          {s.busiestMonth && (
            <Fact
              theme={theme}
              icon="calendar-outline"
              text={`Busiest month: ${MONTHS[Number(s.busiestMonth.key.slice(5)) - 1]} ${s.busiestMonth.key.slice(0, 4)} (${s.busiestMonth.count})`}
            />
          )}
        </View>

        {/* Goal */}
        <Block theme={theme} title={`${year} goal`}>
          {goal ? (
            <>
              <View style={styles.goalHead}>
                <Text style={[styles.goalValue, { color: theme.text }]}>
                  {s.thisYear}
                  <Text style={{ color: theme.textMuted }}> / {goal}</Text>
                </Text>
                <Text style={[styles.goalPct, { color: theme.accent }]}>{Math.round(pct * 100)}%</Text>
              </View>
              <View style={[styles.track, { backgroundColor: theme.elevated }]}>
                <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: theme.accent }]} />
                <View style={[styles.pace, { left: `${Math.min(100, (onPace / goal) * 100)}%`, backgroundColor: theme.text }]} />
              </View>
              <Text style={[styles.hint, { color: theme.textMuted }]}>
                {s.thisYear >= goal
                  ? 'Goal reached. Encore?'
                  : s.thisYear >= onPace
                    ? `Ahead of pace by ${s.thisYear - onPace}. The line marks where you’d be today.`
                    : `${onPace - s.thisYear} behind pace. The line marks where you’d be today.`}
              </Text>
            </>
          ) : (
            <Text style={[styles.hint, { color: theme.textMuted }]}>How many titles will you watch this year?</Text>
          )}
          <View style={styles.goalChips}>
            {GOALS.map((g) => (
              <Pressable
                key={g}
                onPress={() => update({ yearGoal: goal === g ? 0 : g })}
                accessibilityRole="button"
                accessibilityState={{ selected: goal === g }}
                style={[styles.goalChip, { borderColor: goal === g ? theme.accent : theme.border, backgroundColor: goal === g ? theme.accent : 'transparent' }]}
              >
                <Text style={[styles.goalChipText, { color: goal === g ? theme.accentText : theme.text }]}>{g}</Text>
              </Pressable>
            ))}
          </View>
        </Block>

        {/* Activity */}
        <Block theme={theme} title="A year of watching">
          <ActivityGraph weeks={s.weeks} theme={theme} />
          <View style={styles.activityFoot}>
            <Text style={[styles.hint, { color: theme.textMuted, flex: 1 }]}>
              {s.activeDays} days with something logged · streak {s.currentStreak} · best {s.longestStreak}
            </Text>
            <ActivityKey theme={theme} />
          </View>
        </Block>

        {/* Ratings */}
        <Block theme={theme} title="How you rate">
          <RatingChart ratings={s.ratings} theme={theme} />
        </Block>

        {s.topVibes.length > 0 && (
          <Block theme={theme} title="How it felt">
            <View style={styles.vibes}>
              {s.topVibes.map((v, i) => (
                <View key={v.name} style={[styles.vibe, { backgroundColor: i === 0 ? theme.accent : theme.card, borderColor: i === 0 ? theme.accent : theme.border }]}>
                  <Text style={[styles.vibeName, { color: i === 0 ? theme.accentText : theme.text }]}>{v.name.toUpperCase()}</Text>
                  <Text style={[styles.vibeCount, { color: i === 0 ? theme.accentText : theme.textMuted }]}>×{v.count}</Text>
                </View>
              ))}
            </View>
          </Block>
        )}

        {(s.devices.length > 0 || s.platforms.length > 0) && (
          <View style={styles.tops}>
            <TopList theme={theme} title="Watched on" items={s.devices.map((d) => ({ name: deviceLabel(d.name) ?? d.name, count: d.count }))} />
            <TopList theme={theme} title="Services" items={s.platforms} />
          </View>
        )}

        {/* Tops */}
        {(s.topGenres.length > 0 || s.topCredits.length > 0) && (
          <View style={styles.tops}>
            <TopList theme={theme} title="Top genres" items={s.topGenres} />
            <TopList theme={theme} title="Directors and studios" items={s.topCredits} />
          </View>
        )}

        {/* Friends */}
        <Block theme={theme} title={friends.friends.length ? `Friends (${friends.friends.length})` : 'Friends'}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.listsRow}>
            {friends.friends.map((f) => (
              <Pressable
                key={f.id}
                onPress={() => router.push({ pathname: '/friend/[id]', params: { id: f.id } })}
                accessibilityRole="button"
                style={({ pressed }) => [styles.friend, pressed && { opacity: 0.8 }]}
              >
                <Face uri={friends.photos[f.id] ?? null} name={f.name} theme={theme} size={64} round />
                <Text style={[styles.buddyName, { color: theme.text }]} numberOfLines={1}>
                  {f.name}
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => router.push('/friends')}
              accessibilityRole="button"
              style={({ pressed }) => [styles.friend, { opacity: pressed ? 0.7 : 1 }]}
            >
              <View style={[styles.friendAdd, { borderColor: theme.border }]}>
                <Ionicons name={friends.friends.length ? 'people-outline' : 'person-add-outline'} size={24} color={theme.accent} />
              </View>
              <Text style={[styles.buddyName, { color: theme.text }]} numberOfLines={1}>
                {friends.friends.length ? 'All friends' : 'Add friends'}
              </Text>
            </Pressable>
          </ScrollView>
          {!friends.friends.length && (
            <Text style={[styles.hint, { color: theme.textMuted }]}>
              {friends.available ? 'Share your invite code to see each other’s diaries, reviews and lists.' : 'Sign in to add friends with an invite code.'}
            </Text>
          )}
        </Block>

        {/* Your lists */}
        <Block theme={theme} title="Your lists">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.listsRow}>
            {lists.map((l) => (
              <Pressable
                key={l.id}
                onPress={() => router.push({ pathname: '/list/[id]', params: { id: l.id } })}
                accessibilityRole="button"
                style={({ pressed }) => [styles.listCard, pressed && { opacity: 0.8 }]}
              >
                <ListCover items={l.items} theme={theme} width={120} />
                <Text style={[styles.buddyName, { color: theme.text }]} numberOfLines={1}>
                  {l.name}
                </Text>
                <Text style={[styles.hint, { color: theme.textMuted }]}>
                  {l.items.length} {l.items.length === 1 ? 'title' : 'titles'}
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => router.push('/lists')}
              accessibilityRole="button"
              style={({ pressed }) => [styles.listNew, { borderColor: theme.border, opacity: pressed ? 0.7 : 1 }]}
            >
              <Ionicons name={lists.length ? 'albums-outline' : 'add'} size={24} color={theme.accent} />
              <Text style={[styles.hint, { color: theme.text, textAlign: 'center' }]}>{lists.length ? 'All lists' : 'Make a list'}</Text>
            </Pressable>
          </ScrollView>
        </Block>

        {/* Movie buddies */}
        {s.buddies.length > 0 && (
          <Block theme={theme} title="Movie buddies">
            <View style={[styles.buddies, { backgroundColor: theme.card, borderColor: theme.border }]}>
              {s.buddies.slice(0, 6).map((b, i) => (
                <Pressable
                  key={b.name}
                  onPress={() => router.navigate({ pathname: '/diary', params: { q: b.name } })}
                  accessibilityRole="button"
                  accessibilityLabel={`Everything you watched with ${b.name}`}
                  style={({ pressed }) => [
                    styles.buddy,
                    i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <View style={[styles.buddyMark, { backgroundColor: i === 0 ? theme.accent : theme.elevated }]}>
                    <Text style={[styles.buddyInitial, { color: i === 0 ? theme.accentText : theme.text }]}>{b.name[0]?.toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.buddyName, { color: theme.text }]}>{b.name}</Text>
                    <Text style={[styles.hint, { color: theme.textMuted }]}>
                      {[
                        `${b.count} ${b.count === 1 ? 'viewing' : 'viewings'}`,
                        b.topGenre ? `mostly ${b.topGenre.toLowerCase()}` : null,
                        `last ${friendlyDate(b.lastOn).toLowerCase()}`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
                </Pressable>
              ))}
            </View>
          </Block>
        )}

        {/* Achievements */}
        <Block theme={theme} title={`Achievements · ${s.achievements.filter((a) => a.tier).length} of ${s.achievements.length} unlocked`}>
          <Achievements list={s.achievements} theme={theme} />
        </Block>

        <Pressable
          onPress={() => router.push('/profile-card')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.share, { backgroundColor: theme.accent, opacity: pressed ? 0.85 : 1 }]}
        >
          <Ionicons name="logo-instagram" size={20} color={theme.accentText} />
          <Text style={[styles.shareText, { color: theme.accentText }]}>SHARE MY PROFILE CARD</Text>
        </Pressable>

        <FavouritePicker
          visible={picking !== null}
          theme={theme}
          entries={entries}
          onClose={() => setPicking(null)}
          onPick={(f) => {
            if (picking !== null) setFavourite(picking, f);
            setPicking(null);
          }}
        />
      </ScrollView>
    </KeyboardSafe>
  );
}

function Block({ theme, title, children }: { theme: Theme; title: string; children: ReactNode }) {
  return (
    <View style={styles.block}>
      <SectionLabel theme={theme}>{title}</SectionLabel>
      {children}
    </View>
  );
}

function Count({ theme, value, label, color }: { theme: Theme; value: number; label: string; color: string }) {
  return (
    <View style={[styles.number, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[styles.numberValue, { color: theme.text }]} adjustsFontSizeToFit numberOfLines={1}>
        {value.toLocaleString()}
      </Text>
      <View style={styles.numberLabelRow}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={[styles.numberLabel, { color: theme.textMuted }]}>{label}</Text>
      </View>
    </View>
  );
}

function Fact({ theme, icon, text }: { theme: Theme; icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.fact}>
      <Ionicons name={icon} size={16} color={theme.accent} />
      <Text style={[styles.factText, { color: theme.text }]}>{text}</Text>
    </View>
  );
}

function TopList({ theme, title, items }: { theme: Theme; title: string; items: { name: string; count: number }[] }) {
  if (!items.length) return null;
  const max = items[0].count;
  return (
    <View style={[styles.top, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <SectionLabel theme={theme}>{title}</SectionLabel>
      {items.map((it) => (
        <View key={it.name} style={{ gap: 3 }}>
          <View style={styles.topRow}>
            <Text style={[styles.topName, { color: theme.text }]} numberOfLines={1}>
              {it.name}
            </Text>
            <Text style={[styles.topCount, { color: theme.textMuted }]}>{it.count}</Text>
          </View>
          <View style={[styles.topTrack, { backgroundColor: theme.elevated }]}>
            <View style={[styles.fill, { width: `${(it.count / max) * 100}%`, backgroundColor: theme.accent }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 22 },
  who: { alignItems: 'center', gap: 4, paddingTop: 8 },
  save: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 22, borderRadius: 20, marginTop: 8 },
  saveText: { fontFamily: fonts.monoBold, fontSize: font.footnote, letterSpacing: 1.5 },
  photoRing: { width: 112, height: 112, borderRadius: 56, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  photo: { width: 104, height: 104, borderRadius: 52 },
  initial: { fontFamily: fonts.display, fontSize: 54 },
  camera: { position: 'absolute', right: 2, bottom: 2, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: fonts.display, fontSize: font.marquee, letterSpacing: 1, alignSelf: 'stretch', textAlign: 'center', marginTop: 10, paddingVertical: 0 },
  bio: { fontFamily: fonts.mono, fontSize: font.footnote, lineHeight: 18, alignSelf: 'stretch', textAlign: 'center', paddingVertical: 2 },
  block: { gap: 10 },
  favs: { flexDirection: 'row', justifyContent: 'space-between' },
  fav: { borderRadius: 6 },
  emptyFav: { width: 74, height: 111, borderRadius: 6, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  hint: { fontFamily: fonts.mono, fontSize: font.caption, lineHeight: 16 },
  numbers: { flexDirection: 'row', gap: 8 },
  number: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 6, alignItems: 'center' },
  numberValue: { fontFamily: fonts.display, fontSize: 34, includeFontPadding: false },
  numberLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  numberLabel: { fontFamily: fonts.monoBold, fontSize: 10, letterSpacing: 1 },
  facts: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 10, marginTop: -8 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  factText: { flex: 1, fontSize: font.footnote },
  goalHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  goalValue: { fontFamily: fonts.display, fontSize: font.marquee },
  goalPct: { fontFamily: fonts.display, fontSize: font.title2 },
  track: { height: 12, borderRadius: 6, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 6 },
  pace: { position: 'absolute', top: 0, bottom: 0, width: 2 },
  goalChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  goalChip: { height: 34, minWidth: 52, paddingHorizontal: 12, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  goalChipText: { fontFamily: fonts.monoBold, fontSize: font.footnote },
  activityFoot: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  vibes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  friend: { width: 72, alignItems: 'center', gap: 6 },
  friendAdd: { width: 64, height: 64, borderRadius: 32, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  vibe: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, height: 32 },
  vibeName: { fontFamily: fonts.monoBold, fontSize: font.caption, letterSpacing: 1 },
  vibeCount: { fontFamily: fonts.mono, fontSize: font.caption },
  tops: { gap: 10 },
  buddies: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  listsRow: { gap: 12 },
  listCard: { width: 120, gap: 4 },
  listNew: { width: 104, height: 166, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 6 },
  buddy: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  buddyMark: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  buddyInitial: { fontFamily: fonts.display, fontSize: font.title },
  buddyName: { fontSize: font.body, fontWeight: '700' },
  top: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 10 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  topName: { flex: 1, fontSize: font.footnote, fontWeight: '600' },
  topCount: { fontFamily: fonts.monoBold, fontSize: font.caption },
  topTrack: { height: 5, borderRadius: 3, overflow: 'hidden' },
  share: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 54, borderRadius: 27 },
  shareText: { fontFamily: fonts.monoBold, fontSize: font.body, letterSpacing: 1.5 },
});
