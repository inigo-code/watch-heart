import { FlexWidget, ImageWidget, TextWidget } from 'react-native-android-widget';
import type { ColorProp } from 'react-native-android-widget';

import type { UpNextItem, UpNextSnapshot } from './upNext';

type Colours = UpNextSnapshot['dark'];
const c = (hex: string) => hex as ColorProp;

/**
 * The "Up next" widget: what to watch next, each opening its episode tracker or title page, and a + that
 * opens Find. Drawn by Android from this description, so only the widget library's primitives are used.
 */
export function UpNextWidget({ snap, colours, rows }: { snap: UpNextSnapshot; colours: Colours; rows: number }) {
  const items = snap.items.slice(0, rows);
  return (
    <FlexWidget
      style={{ height: 'match_parent', width: 'match_parent', backgroundColor: c(colours.bg), borderRadius: 22, padding: 12, flexDirection: 'column' }}
    >
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: 'watchheart://watchlist' }} style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
          <TextWidget text="UP NEXT" style={{ fontFamily: 'BebasNeue_400Regular', fontSize: 24, color: c(colours.text), letterSpacing: 0.05 }} />
          <TextWidget text="  ♥ WATCH HEART" style={{ fontFamily: 'CourierPrime_700Bold', fontSize: 10, color: c(colours.accent), letterSpacing: 0.1 }} />
        </FlexWidget>
        <FlexWidget
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'watchheart://search' }}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c(colours.accent), justifyContent: 'center', alignItems: 'center' }}
        >
          <TextWidget text="+" style={{ fontSize: 24, color: c(colours.onAccent), fontWeight: 'bold' }} />
        </FlexWidget>
      </FlexWidget>
      {items.length ? (
        items.map((it, i) => <Row key={i} it={it} colours={colours} />)
      ) : (
        <FlexWidget
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'watchheart://watchlist' }}
          style={{ flex: 1, justifyContent: 'center', width: 'match_parent' }}
        >
          <TextWidget
            text="Nothing up next. Track a series, or add something to your watchlist."
            style={{ fontSize: 13, color: c(colours.muted) }}
            maxLines={3}
          />
        </FlexWidget>
      )}
    </FlexWidget>
  );
}

function Row({ it, colours }: { it: UpNextItem; colours: Colours }) {
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: it.uri }}
      style={{
        width: 'match_parent',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c(colours.card),
        borderRadius: 12,
        padding: 6,
        marginTop: 6,
      }}
    >
      {it.poster ? (
        <ImageWidget image={it.poster as `https:${string}`} imageWidth={34} imageHeight={51} radius={4} resizeMode="cover" />
      ) : (
        <FlexWidget style={{ width: 34, height: 51, borderRadius: 4, backgroundColor: c(colours.bg) }} />
      )}
      <FlexWidget style={{ flex: 1, flexDirection: 'column', marginLeft: 10 }}>
        <TextWidget text={it.title} style={{ fontSize: 14, fontWeight: 'bold', color: c(colours.text) }} maxLines={1} truncate="END" />
        <TextWidget text={it.line} style={{ fontFamily: 'CourierPrime_700Bold', fontSize: 12, color: c(colours.accent) }} maxLines={1} />
        <TextWidget text={it.note} style={{ fontSize: 11, color: c(colours.muted) }} maxLines={1} truncate="END" />
      </FlexWidget>
    </FlexWidget>
  );
}

/** How many rows fit a widget this tall (in dp). */
export const rowsFor = (heightDp: number) => Math.max(1, Math.min(4, Math.floor((heightDp - 60) / 69)));
