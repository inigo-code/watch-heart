import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, View } from 'react-native';

import { Text, TextInput } from '@/components/AppText';
import { SectionLabel } from '@/components/SectionLabel';
import { Face } from '@/components/title/Rows';
import { useToast } from '@/components/Toast';
import { answerFriendRequest, cancelFriendRequest, photoUrl, searchPeople, sendFriendRequest, suggestPeople } from '@/friends/friendsApi';
import type { FriendRequest, Person, Suggestion } from '@/friends/friendsApi';
import { useFriends } from '@/friends/FriendsProvider';
import { font, fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';
import { useSettings } from '@/settings/SettingsProvider';

const message = (e: unknown) => (e instanceof Error ? e.message : 'No connection. Try again in a moment.');
const someone = (id: string) => router.push({ pathname: '/someone/[id]', params: { id } });
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;
/** Why someone is suggested: friends you share first, then titles. */
const why = (p: Suggestion) =>
  [p.mutual ? `${plural(p.mutual, 'friend')} in common` : '', p.common ? `${plural(p.common, 'title')} in common` : ''].filter(Boolean).join(' · ');

/**
 * Friends by name: requests waiting for you, people you might know, a search of people who chose to be
 * findable, and your own switches for being found and suggested. Hidden quietly when the server hasn't been set up for it (supabase/people.sql).
 */
export function PeopleSearch({ theme, onFriendsChanged }: { theme: Theme; onFriendsChanged: () => void }) {
  const toast = useToast();
  const { settings, update } = useSettings();
  const { requests, peopleReady, photos, forgetRequest } = useFriends();
  const findable = !!settings.sharing.findable;
  const preview = !!settings.sharing.preview;
  const taste = !!settings.sharing.taste;
  const [suggested, setSuggested] = useState<Suggestion[]>([]);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<{ q: string; people: Person[] } | null>(null);
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const [faces, setFaces] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const q = query.trim();

  useEffect(() => {
    if (q.length < 3 || !peopleReady) return;
    let live = true;
    const timer = setTimeout(() => {
      searchPeople(q)
        .then(async (people) => {
          if (!live) return;
          setFailedFor(null);
          setFound({ q, people });
          const links = await Promise.all(people.map(async (p) => [p.id, p.photoPath ? await photoUrl(p.photoPath) : null] as const));
          const fresh: Record<string, string> = {};
          for (const [id, url] of links) if (url) fresh[id] = url;
          if (live) setFaces((f) => ({ ...f, ...fresh }));
        })
        .catch((e) => {
          if (!live) return;
          setFailedFor(q);
          toast(message(e));
        });
    }, 400);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [q, peopleReady, toast]);

  // People you might know: friends of friends, and (when you both allow it) people with the same titles.
  useEffect(() => {
    if (!peopleReady) return;
    let live = true;
    suggestPeople()
      .then(async (people) => {
        if (!live) return;
        setSuggested(people);
        const links = await Promise.all(people.map(async (p) => [p.id, p.photoPath ? await photoUrl(p.photoPath) : null] as const));
        const fresh: Record<string, string> = {};
        for (const [id, url] of links) if (url) fresh[id] = url;
        if (live) setFaces((f) => ({ ...f, ...fresh }));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [peopleReady, taste]);

  if (!peopleReady) return null;

  const people = q.length >= 3 && found?.q === q ? found.people : null;
  const searching = q.length >= 3 && !people && failedFor !== q;
  const setStatus = (id: string, status: Person['status']) => {
    setFound((f) => (f ? { ...f, people: f.people.map((p) => (p.id === id ? { ...p, status } : p)) } : f));
    setSuggested((list) => list.map((p) => (p.id === id ? { ...p, status } : p)));
  };
  const dropFound = (id: string) => {
    setFound((f) => (f ? { ...f, people: f.people.filter((x) => x.id !== id) } : f));
    setSuggested((list) => list.filter((x) => x.id !== id));
  };

  const personRow = (p: Person, why?: string) => (
    <View key={p.id} style={[styles.person, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Pressable
        onPress={p.previewable ? () => someone(p.id) : undefined}
        disabled={!p.previewable}
        accessibilityRole={p.previewable ? 'button' : undefined}
        accessibilityLabel={p.previewable ? `See ${p.name}’s profile` : undefined}
        style={styles.who}
      >
        <Face uri={faces[p.id] ?? null} name={p.name} theme={theme} size={40} round />
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
            {p.name}
          </Text>
          {!!(why || p.bio) && (
            <Text style={[styles.bio, { color: why ? theme.accent : theme.textMuted }]} numberOfLines={1}>
              {why || p.bio}
            </Text>
          )}
        </View>
      </Pressable>
      {busy === p.id ? (
        <ActivityIndicator color={theme.accent} />
      ) : (
        <Pressable
          onPress={() => ask(p)}
          accessibilityRole="button"
          accessibilityLabel={p.status === 'sent' ? `Take back your request to ${p.name}` : p.status === 'received' ? `Accept ${p.name}` : `Ask ${p.name} to be friends`}
          style={[styles.btn, p.status === 'sent' ? { borderWidth: 1, borderColor: theme.border } : { backgroundColor: theme.accent }]}
        >
          <Text style={[styles.btnText, { color: p.status === 'sent' ? theme.text : theme.accentText }]}>
            {p.status === 'sent' ? 'REQUESTED' : p.status === 'received' ? 'ACCEPT' : 'ADD'}
          </Text>
        </Pressable>
      )}
    </View>
  );

  const ask = async (p: Person) => {
    setBusy(p.id);
    try {
      if (p.status === 'sent') {
        await cancelFriendRequest(p.id);
        setStatus(p.id, 'none');
      } else {
        const r = await sendFriendRequest(p.id);
        if (r === 'friends') {
          dropFound(p.id);
          forgetRequest(p.id);
          onFriendsChanged();
          toast(`You and ${p.name} are friends now`);
        } else {
          setStatus(p.id, 'sent');
          toast(`Asked ${p.name}`);
        }
      }
    } catch (e) {
      toast(message(e));
    } finally {
      setBusy(null);
    }
  };

  const answer = async (r: FriendRequest, accept: boolean) => {
    setBusy(r.id);
    try {
      await answerFriendRequest(r.id, accept);
      forgetRequest(r.id);
      if (accept) {
        dropFound(r.id);
        onFriendsChanged();
        toast(`You and ${r.name} are friends now`);
      } else {
        setStatus(r.id, 'none');
      }
    } catch (e) {
      toast(message(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      {requests.length > 0 && (
        <View style={styles.block}>
          <SectionLabel theme={theme}>Friend requests ({requests.length})</SectionLabel>
          {requests.map((r) => (
            <View key={r.id} style={[styles.person, { backgroundColor: theme.card, borderColor: theme.accent }]}>
              <Pressable onPress={() => someone(r.id)} accessibilityRole="button" accessibilityLabel={`See ${r.name}’s profile`} style={styles.who}>
                <Face uri={photos[r.id] ?? null} name={r.name} theme={theme} size={40} round />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                    {r.name}
                  </Text>
                  <Text style={[styles.bio, { color: theme.textMuted }]} numberOfLines={1}>
                    {r.bio || 'Tap to see their profile'}
                  </Text>
                </View>
              </Pressable>
              {busy === r.id ? (
                <ActivityIndicator color={theme.accent} />
              ) : (
                <>
                  <Pressable onPress={() => answer(r, false)} accessibilityRole="button" accessibilityLabel={`Decline ${r.name}`} hitSlop={6} style={[styles.icon, { borderColor: theme.border }]}>
                    <Ionicons name="close" size={18} color={theme.text} />
                  </Pressable>
                  <Pressable onPress={() => answer(r, true)} accessibilityRole="button" accessibilityLabel={`Accept ${r.name}`} style={[styles.btn, { backgroundColor: theme.accent }]}>
                    <Text style={[styles.btnText, { color: theme.accentText }]}>ACCEPT</Text>
                  </Pressable>
                </>
              )}
            </View>
          ))}
        </View>
      )}

      {suggested.length > 0 && (
        <View style={styles.block}>
          <SectionLabel theme={theme}>People you might know</SectionLabel>
          {suggested.map((p) => personRow(p, why(p)))}
        </View>
      )}

      <View style={styles.block}>
        <SectionLabel theme={theme}>Find by name</SectionLabel>
        <View style={[styles.search, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Ionicons name="search" size={18} color={theme.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Their name, three letters or more"
            placeholderTextColor={theme.textMuted}
            autoCorrect={false}
            returnKeyType="search"
            style={[styles.input, { color: theme.text }]}
          />
          {searching && <ActivityIndicator size="small" color={theme.accent} />}
        </View>
        {people?.map((p) => personRow(p))}
        {people && !people.length && <Text style={[styles.bio, { color: theme.textMuted }]}>No one by that name, or they’ve chosen not to be found.</Text>}
        <View style={[styles.switchRow, { borderColor: theme.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: theme.text }]}>Let people find me by name</Text>
            <Text style={[styles.bio, { color: theme.textMuted }]}>
              {!settings.name.trim() ? 'Add your name on your profile first.' : findable && preview ? 'They see your name and profile' : 'They see only your name and bio'}
            </Text>
          </View>
          <Switch
            value={findable}
            onValueChange={(on) => {
              if (on && !settings.name.trim()) {
                router.push('/profile');
                return;
              }
              update({ sharing: { ...settings.sharing, findable: on } });
            }}
            trackColor={{ true: theme.accent, false: theme.border }}
            accessibilityLabel="Let people find me by name"
          />
        </View>
        {findable && (
          <View style={[styles.switchRow, { borderColor: theme.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: theme.text }]}>Show my profile in search</Text>
              <Text style={[styles.bio, { color: theme.textMuted }]}>Photo, bio, favourite four and titles logged. Never your diary.</Text>
            </View>
            <Switch
              value={preview}
              onValueChange={(on) => update({ sharing: { ...settings.sharing, preview: on } })}
              trackColor={{ true: theme.accent, false: theme.border }}
              accessibilityLabel="Show my profile in search"
            />
          </View>
        )}
        {findable && (
          <View style={[styles.switchRow, { borderColor: theme.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: theme.text }]}>Suggest me to people who watch the same things</Text>
              <Text style={[styles.bio, { color: theme.textMuted }]}>Only to people who turn this on too. They see how many titles you share, never which.</Text>
            </View>
            <Switch
              value={taste}
              onValueChange={(on) => update({ sharing: { ...settings.sharing, taste: on } })}
              trackColor={{ true: theme.accent, false: theme.border }}
              accessibilityLabel="Suggest me to people who watch the same things"
            />
          </View>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  block: { gap: 10 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 48 },
  input: { flex: 1, fontSize: font.body },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 12, padding: 10 },
  who: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontSize: font.body, fontWeight: '700' },
  bio: { fontFamily: fonts.mono, fontSize: font.caption, marginTop: 2 },
  btn: { height: 34, paddingHorizontal: 14, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: fonts.monoBold, fontSize: font.caption, letterSpacing: 1 },
  icon: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
});
