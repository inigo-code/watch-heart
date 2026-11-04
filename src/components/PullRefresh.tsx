import { useCallback, useState } from 'react';
import { RefreshControl } from 'react-native';

import type { Theme } from '@/lib/theme';

/** Pull to refresh, the same on every page: `control` goes in a list's refreshControl. */
export function usePullRefresh(theme: Theme, run: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    run()
      .catch(() => {})
      .finally(() => setRefreshing(false));
  }, [run]);
  return <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} colors={[theme.accent]} progressBackgroundColor={theme.card} />;
}
