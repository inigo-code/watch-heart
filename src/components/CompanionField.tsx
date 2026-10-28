import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { cleanName, withName } from '@/lib/companions';
import { font, fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';

/** Who you watched it with: names as removable chips, a box to add one, and the people you watch with most. */
export function CompanionField({ names, onChange, known, theme }: { names: string[]; onChange: (names: string[]) => void; known: string[]; theme: Theme }) {
  const [text, setText] = useState('');
  const add = (name: string) => {
    const next = withName(names, name);
    if (next !== names) onChange(next);
    setText('');
  };
  const typed = cleanName(text).toLowerCase();
  const chosen = new Set(names.map((n) => n.toLowerCase()));
  const suggestions = known.filter((n) => !chosen.has(n.toLowerCase()) && (!typed || n.toLowerCase().includes(typed))).slice(0, 8);

  return (
    <View style={styles.wrap}>
      {names.length > 0 && (
        <View style={styles.row}>
          {names.map((n) => (
            <Pressable
              key={n}
              onPress={() => onChange(names.filter((x) => x !== n))}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${n}`}
              style={[styles.chosen, { backgroundColor: theme.chipActive }]}
            >
              <Ionicons name="person" size={12} color={theme.chipActiveText} />
              <Text style={[styles.chosenText, { color: theme.chipActiveText }]}>{n}</Text>
              <Ionicons name="close" size={14} color={theme.chipActiveText} />
            </Pressable>
          ))}
        </View>
      )}
      <View style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Ionicons name="people-outline" size={18} color={theme.textMuted} />
        <TextInput
          value={text}
          onChangeText={(t) => {
            // A comma finishes a name.
            if (t.includes(',')) t.split(',').slice(0, -1).forEach((n) => add(n));
            setText(t.includes(',') ? (t.split(',').pop() ?? '') : t);
          }}
          onSubmitEditing={() => add(text)}
          submitBehavior="submit"
          returnKeyType="done"
          placeholder={names.length ? 'Add someone else' : 'Add a name: who was there?'}
          placeholderTextColor={theme.textMuted}
          style={[styles.field, { color: theme.text }]}
          autoCapitalize="words"
          maxLength={30}
        />
        {!!typed && (
          <Pressable onPress={() => add(text)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Add ${cleanName(text)}`}>
            <Ionicons name="add-circle" size={24} color={theme.accent} />
          </Pressable>
        )}
      </View>
      {suggestions.length > 0 && (
        <View style={styles.row}>
          {suggestions.map((n) => (
            <Pressable key={n} onPress={() => add(n)} accessibilityRole="button" accessibilityLabel={`Add ${n}`} style={[styles.suggestion, { borderColor: theme.border }]}>
              <Ionicons name="add" size={13} color={theme.accent} />
              <Text style={[styles.suggestionText, { color: theme.text }]}>{n}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chosen: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 12, borderRadius: 16 },
  chosenText: { fontSize: font.footnote, fontWeight: '700' },
  input: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, minHeight: 46 },
  field: { flex: 1, fontSize: font.body, paddingVertical: 8 },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 30, paddingHorizontal: 10, borderRadius: 15, borderWidth: 1, borderStyle: 'dashed' },
  suggestionText: { fontFamily: fonts.mono, fontSize: font.caption },
});
