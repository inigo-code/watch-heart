import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { SectionLabel } from '@/components/SectionLabel';
import { Face } from '@/components/title/Rows';
import { useToast } from '@/components/Toast';
import { answerFriendRequest, cancelFriendRequest, friendRequests, notSetUp, searchPeople, sendFriendRequest } from '@/friends/friendsApi';
import type { FriendRequest, Person } from '@/friends/friendsApi';
import { font, fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';
import { useSettings } from '@/settings/SettingsProvider';

const message = (e: unknown) => (e instanceof Error ? e.message : 'No connection. Try again in a moment.');

/**
 * Friends by name: requests waiting for you, a search of people who chose to be findable, and your own
 * switch for being found. Hidden quietly when the server hasn't been set up for it (supabase/people.sql).
 */
export function PeopleSearch({ theme, onFriendsChanged }: { theme: Theme; onFriendsChanged: () => void }) {
  const toast = useToast();
  const { settings, update } = useSettings();
  const findable = !!settings.sharing.findable;
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [missing, setMissing] = useState(false);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<{ q: string; people: Person[] } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const q = query.trim();

  const loadRequests = useCallback(() => {
    friendRequests()
      .then(setRequests)
      .catch((e) => notSetUp(e) && setMissing(true));
  }, []);
  useEffect(loadRequests, [loadRequests]);

  useEffect(() => {
    if (q.length < 3 || missing) return;
    let live = true;
    const timer = setTimeout(() => {
      searchPeople(q)
        .then((people) => live && setFound({ q, people }))
        .catch((e) => {
          if (!live) return;
          if (notSetUp(e)) setMissing(true);
          else toast(message(e));
        });
    }, 400);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [q, missing, toast]);

  if (missing) return null;

  const people = q.length >= 3 && found?.q === q ? found.people : null;
  const setStatus = (id: string, status: Person['status']) =>
    setFound((f) => (f ? { ...f, people: f.people.map((p) => (p.id === id ? { ...p, status } : p)) } : f));

  const ask = async (p: Person) => {
    setBusy(p.id);
    try {
      if (p.status === 'sent') {
        await cancelFriendRequest(p.id);
        setStatus(p.id, 'none');
      } else {
        const r = await sendFriendRequest(p.id);
        if (r === 'friends') {
          setFound((f) => (f ? { ...f, people: f.people.filter((x) => x.id !== p.id) } : f));
          loadRequests();
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
      setRequests((list) => list.filter((x) => x.id !== r.id));
      if (accept) {
        onFriendsChanged();
        toast(`You and ${r.name} are friends now`);
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
          <SectionLabel theme={theme}>Friend requests</SectionLabel>
          {requests.map((r) => (
            <View key={r.id} style={[styles.person, { backgroundColor: theme.card, borderColor: theme.accent }]}>
              <Face uri={null} name={r.name} theme={theme} size={40} round />
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                  {r.name}
                </Text>
                {!!r.bio && (
                  <Text style={[styles.bio, { color: theme.textMuted }]} numberOfLines={1}>
                    {r.bio}
                  </Text>
                )}
              </View>
              {busy === r.id ? (
                <ActivityIndicator color={theme.accent} />
              ) : (
                <>
                  <Pressable onPress={() => answer(r, false)} accessibilityRole="button" accessibilityLabel={`Decline ${r.name}`} hitSlop={6} style={[styles.icon, { borderColor: theme.border }]}>
                    <Ionicons name="close" size={18} color={theme.text} />
                  </Pressable>
                  <Pressable onPress={() => answer(r, true)} accessibilityRole="button" style={[styles.btn, { backgroundColor: theme.accent }]}>
                    <Text style={[styles.btnText, { color: theme.accentText }]}>ACCEPT</Text>
                  </Pressable>
                </>
              )}
            </View>
          ))}
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
        </View>
        {people?.map((p) => (
          <View key={p.id} style={[styles.person, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Face uri={null} name={p.name} theme={theme} size={40} round />
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                {p.name}
              </Text>
              {!!p.bio && (
                <Text style={[styles.bio, { color: theme.textMuted }]} numberOfLines={1}>
                  {p.bio}
                </Text>
              )}
            </View>
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
        ))}
        {people && !people.length && <Text style={[styles.bio, { color: theme.textMuted }]}>No one by that name, or they’ve chosen not to be found.</Text>}
        <View style={[styles.switchRow, { borderColor: theme.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: theme.text }]}>Let people find me by name</Text>
            <Text style={[styles.bio, { color: theme.textMuted }]}>
              {settings.name.trim() ? 'They see your name and bio, and can ask to be friends. Nothing else until you accept.' : 'Add your name on your profile first.'}
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
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  block: { gap: 10 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 48 },
  input: { flex: 1, fontSize: font.body },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 12, padding: 10 },
  name: { fontSize: font.body, fontWeight: '700' },
  bio: { fontFamily: fonts.mono, fontSize: font.caption, marginTop: 2 },
  btn: { height: 34, paddingHorizontal: 14, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: fonts.monoBold, fontSize: font.caption, letterSpacing: 1 },
  icon: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
});
