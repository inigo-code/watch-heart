import type { WidgetInfo, WidgetRepresentation } from 'react-native-android-widget';

import type { UpNextSnapshot } from './upNext';
import { UpNextWidget, rowsFor } from './UpNextWidget';

/** The widget in the app's look: one look when the app has one chosen, or light and dark when it follows the phone. */
export function renderUpNext(snap: UpNextSnapshot, info: WidgetInfo): WidgetRepresentation {
  const rows = rowsFor(info.height);
  if (snap.mode === 'light') return <UpNextWidget snap={snap} colours={snap.light} rows={rows} />;
  if (snap.mode === 'dark') return <UpNextWidget snap={snap} colours={snap.dark} rows={rows} />;
  return {
    light: <UpNextWidget snap={snap} colours={snap.light} rows={rows} />,
    dark: <UpNextWidget snap={snap} colours={snap.dark} rows={rows} />,
  };
}
