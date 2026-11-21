import { Image } from 'expo-image';

/**
 * Watch Heart's own icons, drawn for it (assets/icons/src, redrawn with `node store/make/icons.mjs`): a cinema
 * front for Home, a ticket stub for the Diary, a lens on a frame for Find, a bookmark for the Watchlist, a reel
 * for Recap and a clapperboard for logging. Each has a line form and a filled one (`on`) for the tab you're on.
 * They're pictures tinted to the colour asked for, so they ship over the air.
 */
const ICONS = {
  home: [require('../../assets/icons/home.png'), require('../../assets/icons/home-on.png')],
  diary: [require('../../assets/icons/diary.png'), require('../../assets/icons/diary-on.png')],
  find: [require('../../assets/icons/find.png'), require('../../assets/icons/find-on.png')],
  watchlist: [require('../../assets/icons/watchlist.png'), require('../../assets/icons/watchlist-on.png')],
  recap: [require('../../assets/icons/recap.png'), require('../../assets/icons/recap-on.png')],
  log: [require('../../assets/icons/log.png'), require('../../assets/icons/log.png')],
} as const;

export type CineIconName = keyof typeof ICONS;

export function CineIcon({ name, size = 24, color, on = false }: { name: CineIconName; size?: number; color: string; on?: boolean }) {
  return <Image source={ICONS[name][on ? 1 : 0]} tintColor={color} style={{ width: size, height: size }} contentFit="contain" accessible={false} />;
}
