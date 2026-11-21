import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback } from 'react';

import { onDay } from '@/components/DaySheet';
import { useToast } from '@/components/Toast';
import { today } from '@/lib/dates';
import { blankDraft } from '@/lib/entryDraft';
import type { Day } from '@/lib/tracking';
import { useSettings } from '@/settings/SettingsProvider';
import { useDiary } from '@/store/DiaryStore';
import type { Title } from '@/store/types';

/**
 * Logs a title as watched on a day, without the form: no stars or words, which "Edit" on the toast adds.
 * A film seen before counts as a rewatch, as the form does.
 */
export function useQuickLog() {
  const { addEntry, viewingsOf, queued } = useDiary();
  const { settings } = useSettings();
  const toast = useToast();
  return useCallback(
    (t: Title, when: Day) => {
      // A show tracked episode by episode stays on the watchlist.
      const waiting = queued(t);
      const entry = addEntry({
        ...blankDraft(t),
        watchedOn: when.undated ? today() : when.watchedOn,
        ...(when.undated ? { undated: true } : {}),
        rewatch: t.kind === 'movie' && viewingsOf(t.source, t.sourceId).length > 0,
      });
      if (settings.haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      toast(`Logged ${onDay(when)}${waiting && !waiting.track ? ' and taken off your watchlist' : ''}`, {
        label: 'Edit',
        onPress: () => router.push({ pathname: '/log', params: { id: entry.id } }),
      });
    },
    [addEntry, viewingsOf, queued, settings.haptics, toast],
  );
}
