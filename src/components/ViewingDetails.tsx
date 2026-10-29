import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { tmdbKey } from '@/api';
import { watchRegion } from '@/api/omdb';
import { aboutTmdb, extrasTmdb } from '@/api/tmdb';
import type { Person } from '@/api/tmdb';
import { Chip } from '@/components/Film';
import { SectionLabel } from '@/components/SectionLabel';
import { Face } from '@/components/title/Rows';
import { useToast } from '@/components/Toast';
import { font, fonts } from '@/lib/theme';
import { easeNextLayout } from '@/lib/motion';
import type { Theme } from '@/lib/theme';
import { CONTEXTS, DEVICES, FORMATS, MAX_VIBES, VIBES, hasViewingDetails } from '@/lib/viewing';
import { useSettings } from '@/settings/SettingsProvider';
import type { Entry } from '@/store/types';

type Details = Pick<Entry, 'vibes' | 'device' | 'context' | 'platform' | 'character' | 'source' | 'sourceId'>;

/**
 * The optional extras on the log form, folded away so logging stays quick: vibes, what you watched it on,
 * where, which service, and your favourite character (from TMDB's cast).
 */
export function ViewingDetails({ draft, onChange, theme }: { draft: Details; onChange: (patch: Partial<Entry>) => void; theme: Theme }) {
  const toast = useToast();
  const { settings } = useSettings();
  const key = tmdbKey(settings.tmdbKey);
  const region = watchRegion(settings.watchRegion);
  const [open, setOpen] = useState(() => hasViewingDetails(draft));
  const [cast, setCast] = useState<{ id: string; people: Person[] } | null>(null);
  const [services, setServices] = useState<{ id: string; names: string[] } | null>(null);
  const tmdb = draft.source === 'tmdb' && !!draft.sourceId && !!key;
  const id = draft.sourceId;

  // Cast and services are only looked up once the section is opened.
  useEffect(() => {
    if (!open || !tmdb) return;
    const controller = new AbortController();
    aboutTmdb(key, id, controller.signal)
      .then((a) => setCast({ id, people: a.cast.filter((p) => p.role).slice(0, 20) }))
      .catch(() => {});
    extrasTmdb(key, id, region, controller.signal)
      .then((x) => setServices({ id, names: [...(x.watch?.stream ?? []), ...(x.watch?.free ?? [])].map((p) => p.name).slice(0, 5) }))
      .catch(() => {});
    return () => controller.abort();
  }, [open, tmdb, key, id, region]);

  const vibes = draft.vibes ?? [];
  const context = draft.context ?? [];
  const people = cast?.id === id ? cast.people : [];
  const serviceNames = services?.id === id ? services.names : [];
  const platforms = [...new Set([...serviceNames, ...(draft.platform && !FORMATS.includes(draft.platform) ? [draft.platform] : []), ...FORMATS])];
  const count = vibes.length + context.length + (draft.device ? 1 : 0) + (draft.platform ? 1 : 0) + (draft.character ? 1 : 0);

  const toggleVibe = (v: string) => {
    if (vibes.includes(v)) onChange({ vibes: vibes.filter((x) => x !== v) });
    else if (vibes.length >= MAX_VIBES) toast(`Up to ${MAX_VIBES} vibes. Untick one first.`);
    else onChange({ vibes: [...vibes, v] });
  };

  return (
    <View style={[styles.wrap, { borderColor: theme.border, backgroundColor: theme.card }]}>
      <Pressable
        onPress={() => {
          easeNextLayout();
          setOpen((o) => !o);
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={styles.head}
      >
        <Ionicons name="sparkles-outline" size={18} color={theme.accent} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.text }]}>More about this viewing</Text>
          <Text style={[styles.sub, { color: theme.textMuted }]}>{count ? `${count} picked` : 'Vibes, screen, place, service, favourite character'}</Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={theme.textMuted} />
      </Pressable>

      {open && (
        <View style={styles.body}>
          <Group theme={theme} title="Vibes" note={`Up to ${MAX_VIBES}`}>
            {VIBES.map((v) => (
              <Chip key={v} theme={theme} label={v} active={vibes.includes(v)} onPress={() => toggleVibe(v)} />
            ))}
          </Group>

          <Group theme={theme} title="Watched on" note="Pick one">
            {DEVICES.map((d) => (
              <Chip
                key={d.key}
                theme={theme}
                icon={d.icon}
                label={d.label}
                active={draft.device === d.key}
                onPress={() => onChange({ device: draft.device === d.key ? null : d.key })}
              />
            ))}
          </Group>

          <Group theme={theme} title="Where" note="Pick any">
            {CONTEXTS.map((c) => (
              <Chip
                key={c.key}
                theme={theme}
                icon={c.icon}
                label={c.label}
                active={context.includes(c.key)}
                onPress={() => onChange({ context: context.includes(c.key) ? context.filter((x) => x !== c.key) : [...context, c.key] })}
              />
            ))}
          </Group>

          <Group theme={theme} title="Service" note="Pick one">
            {platforms.map((p) => (
              <Chip key={p} theme={theme} label={p} active={draft.platform === p} onPress={() => onChange({ platform: draft.platform === p ? null : p })} />
            ))}
          </Group>

          {(people.length > 0 || draft.character) && (
            <View style={styles.group}>
              <View style={styles.groupHead}>
                <SectionLabel theme={theme} style={{ flex: 1 }}>
                  Favourite character
                </SectionLabel>
                <Text style={[styles.note, { color: theme.textMuted }]}>Pick one</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cast}>
                {(people.length ? people : []).map((p) => {
                  const picked = draft.character?.name === p.role && draft.character?.actor === p.name;
                  return (
                    <Pressable
                      key={`${p.id}:${p.role}`}
                      onPress={() => onChange({ character: picked ? null : { name: p.role, actor: p.name, photo: p.photo } })}
                      accessibilityRole="button"
                      accessibilityState={{ selected: picked }}
                      accessibilityLabel={`${p.role}, played by ${p.name}`}
                      style={styles.person}
                    >
                      <View style={[styles.ring, { borderColor: picked ? theme.accent : 'transparent' }]}>
                        <Face uri={p.photo} name={p.role} theme={theme} size={64} round />
                      </View>
                      <Text style={[styles.character, { color: picked ? theme.accent : theme.text }]} numberOfLines={2}>
                        {p.role}
                      </Text>
                      <Text style={[styles.actor, { color: theme.textMuted }]} numberOfLines={1}>
                        {p.name}
                      </Text>
                    </Pressable>
                  );
                })}
                {!people.length && draft.character && (
                  <Pressable
                    onPress={() => onChange({ character: null })}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${draft.character.name}`}
                    style={styles.person}
                  >
                    <View style={[styles.ring, { borderColor: theme.accent }]}>
                      <Face uri={draft.character.photo} name={draft.character.name} theme={theme} size={64} round />
                    </View>
                    <Text style={[styles.character, { color: theme.accent }]} numberOfLines={2}>
                      {draft.character.name}
                    </Text>
                  </Pressable>
                )}
              </ScrollView>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function Group({ theme, title, note, children }: { theme: Theme; title: string; note: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <View style={styles.groupHead}>
        <SectionLabel theme={theme} style={{ flex: 1 }}>
          {title}
        </SectionLabel>
        <Text style={[styles.note, { color: theme.textMuted }]}>{note}</Text>
      </View>
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderWidth: 1, borderRadius: 14 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  title: { fontSize: font.body, fontWeight: '700' },
  sub: { fontFamily: fonts.mono, fontSize: font.caption, marginTop: 2 },
  body: { paddingHorizontal: 14, paddingBottom: 16, gap: 18 },
  group: { gap: 10 },
  groupHead: { flexDirection: 'row', alignItems: 'center' },
  note: { fontFamily: fonts.mono, fontSize: font.caption },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cast: { gap: 12, paddingRight: 8 },
  person: { width: 76, alignItems: 'center' },
  ring: { borderWidth: 2.5, borderRadius: 40, padding: 2 },
  character: { fontSize: font.caption, fontWeight: '700', textAlign: 'center', marginTop: 6 },
  actor: { fontFamily: fonts.mono, fontSize: 10, textAlign: 'center' },
});
