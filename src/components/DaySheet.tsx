import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useCallback, useState } from 'react';
import { Platform } from 'react-native';

import { ActionSheet } from '@/components/ActionSheet';
import type { SheetAction } from '@/components/ActionSheet';
import { daysAgo, friendlyDate, isoDate, today } from '@/lib/dates';
import type { Day } from '@/lib/tracking';

type Ask = {
  title?: string;
  /** "Watched", "Seen": starts each choice ("Watched today", "Watched on a date…"). */
  verb?: string;
  /** More choices after the days, e.g. "Catch up to here" or "Untick". */
  extra?: SheetAction[];
};

/** "today", "yesterday", "Mon 3 Nov 2025", "date unknown": for toasts. */
export const dayWords = (d: Day) =>
  d.undated ? 'date unknown' : d.watchedOn === today() || d.watchedOn === daysAgo(1) ? friendlyDate(d.watchedOn).toLowerCase() : friendlyDate(d.watchedOn);

/** "today", "yesterday", "on Mon 3 Nov 2025", "with no date": after "Logged", in toasts. */
export const onDay = (d: Day) =>
  d.undated ? 'with no date' : d.watchedOn === today() || d.watchedOn === daysAgo(1) ? friendlyDate(d.watchedOn).toLowerCase() : `on ${friendlyDate(d.watchedOn)}`;

/**
 * Asks which day something was watched: today, yesterday, a date (Android's calendar), or "don't remember".
 * `ask` opens it; render `sheet` once on the page.
 */
export function useDaySheet() {
  const [open, setOpen] = useState<(Ask & { onPick: (d: Day) => void }) | null>(null);
  const ask = useCallback((what: Ask, onPick: (d: Day) => void) => setOpen({ ...what, onPick }), []);

  const verb = open?.verb ?? 'Watched';
  const pick = open?.onPick;
  const actions: SheetAction[] = open
    ? [
        { label: `${verb} today`, icon: 'today-outline', onPress: () => pick?.({ watchedOn: today() }) },
        { label: `${verb} yesterday`, icon: 'time-outline', onPress: () => pick?.({ watchedOn: daysAgo(1) }) },
        ...(Platform.OS === 'android'
          ? [
              {
                label: `${verb} on a date…`,
                icon: 'calendar-outline' as const,
                onPress: () =>
                  DateTimePickerAndroid.open({
                    value: new Date(),
                    mode: 'date',
                    maximumDate: new Date(),
                    onChange: (e, d) => e.type === 'set' && d && pick?.({ watchedOn: isoDate(d) }),
                  }),
              },
            ]
          : []),
        { label: `${verb}, don’t remember when`, icon: 'help-circle-outline', onPress: () => pick?.({ watchedOn: today(), undated: true }) },
        ...(open.extra ?? []),
      ]
    : [];

  const sheet = <ActionSheet visible={open !== null} title={open?.title} actions={actions} onClose={() => setOpen(null)} />;
  return { ask, sheet };
}
