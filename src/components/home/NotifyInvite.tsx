import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';

import { TipCard } from '@/components/TipCard';
import { askForNotifications, canNotify, notificationsAllowed } from '@/lib/nudgeSchedule';
import { useTheme } from '@/lib/theme';
import { useSettings } from '@/settings/SettingsProvider';
import { useDiary } from '@/store/DiaryStore';

const TIP = 'notifications';

/** Once you've logged something, an offer of notifications, asked only here and only until you answer. */
export function NotifyInvite() {
  const theme = useTheme();
  const { settings, update } = useSettings();
  const { entries } = useDiary();
  const [allowed, setAllowed] = useState(true);
  useEffect(() => {
    if (!canNotify) return;
    let live = true;
    notificationsAllowed()
      .then((a) => live && setAllowed(a))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  if (allowed || !entries.length || settings.dismissedTips.includes(TIP)) return null;
  const dismiss = () => update({ dismissedTips: [...settings.dismissedTips, TIP] });
  return (
    <TipCard
      theme={theme}
      icon={<Ionicons name="notifications-outline" size={18} color={theme.text} />}
      title="Never miss a new episode"
      onDismiss={dismiss}
      action={{
        label: 'Turn on',
        onPress: () => {
          dismiss();
          askForNotifications()
            .then(setAllowed)
            .catch(() => {});
        },
      }}
    >
      New episodes, weekend picks and your monthly recap
    </TipCard>
  );
}
