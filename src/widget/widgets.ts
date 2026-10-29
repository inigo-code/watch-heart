import { registerWidgetTaskHandler, requestWidgetUpdate } from 'react-native-android-widget';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { today } from '@/lib/dates';
import { storage } from '@/lib/storage';

import { renderUpNext } from './render';
import { WIDGET_KEY, upNextSnapshot } from './upNext';
import type { UpNextSnapshot } from './upNext';

// Android home-screen widgets (react-native-android-widget). The web preview uses widgets.web.ts.

const NAME = 'UpNext';

async function saved(): Promise<UpNextSnapshot> {
  try {
    const raw = await storage.getItem(WIDGET_KEY);
    if (raw) return JSON.parse(raw) as UpNextSnapshot;
  } catch {}
  // Added before the app has worked anything out: an empty widget in the default look.
  return upNextSnapshot([], today(), 'marquee');
}

/** Android asks for the widget when it's added, resized, or due a refresh; it's drawn from the saved snapshot. */
async function taskHandler(props: WidgetTaskHandlerProps) {
  if (props.widgetInfo.widgetName !== NAME) return;
  if (props.widgetAction === 'WIDGET_ADDED' || props.widgetAction === 'WIDGET_UPDATE' || props.widgetAction === 'WIDGET_RESIZED') {
    props.renderWidget(renderUpNext(await saved(), props.widgetInfo));
  }
}

/** Called once from the app's entry (index.ts), before anything else. */
export function registerWidgets() {
  registerWidgetTaskHandler(taskHandler);
}

/** Saves the snapshot and redraws any Up next widgets on the home screen. */
export async function updateWidgets(snap: UpNextSnapshot) {
  await storage.setItem(WIDGET_KEY, JSON.stringify(snap));
  await requestWidgetUpdate({ widgetName: NAME, renderWidget: (info) => renderUpNext(snap, info) });
}
