import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useState } from 'react';

import { Row } from '@/components/SettingsUI';
import { useToast } from '@/components/Toast';
import type { Theme } from '@/lib/theme';

// Updates download on launch and apply on the next restart; this checks for one and applies it now.
// The update APIs reject in Expo Go, dev builds and the web preview, so there it only says so.
const canUpdate = Updates.isEnabled && !__DEV__;

/** What's running: "1.0.0 · update 5bdf7e74, 27 Oct" or "1.0.0 · built-in". */
export function describeRunning(): string {
  const version = Constants.expoConfig?.version ?? '';
  if (!canUpdate) return `${version} · development`;
  if (Updates.isEmbeddedLaunch || !Updates.updateId) return `${version} · built-in`;
  const when = Updates.createdAt ? Updates.createdAt.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '';
  return `${version} · update ${Updates.updateId.slice(0, 8)}${when ? `, ${when}` : ''}`;
}

export function UpdateRow({ theme, last }: { theme: Theme; last?: boolean }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const check = async () => {
    if (!canUpdate) {
      toast('Updates work in the installed app');
      return;
    }
    setBusy(true);
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) {
        toast('You’re on the latest version');
        return;
      }
      toast('Downloading the new cut…');
      const fetched = await Updates.fetchUpdateAsync();
      if (fetched.isNew) await Updates.reloadAsync();
      else toast('You’re on the latest version');
    } catch (e) {
      toast(`Couldn’t check for updates: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return <Row theme={theme} icon="cloud-download-outline" label="Check for updates" value={describeRunning()} busy={busy} onPress={check} last={last} />;
}
