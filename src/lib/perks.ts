import { useMemo } from 'react';

import { today } from '@/lib/dates';
import { profileStats } from '@/lib/profileStats';
import type { Achievement, Tier } from '@/lib/profileStats';
import type { AccentKey } from '@/settings/SettingsProvider';
import { useDiary } from '@/store/DiaryStore';
import type { PaletteKey } from '@/story/palettes';

/**
 * Perks: looks you earn with achievements. Every tier reached is worth points (wood 1 … platinum 5), and
 * points unlock new accents and story palettes. Nothing that was already there is ever locked.
 */
export type Perk = { kind: 'accent'; key: AccentKey; points: number; name: string } | { kind: 'palette'; key: PaletteKey; points: number; name: string };

export const PERKS: Perk[] = [
  { kind: 'accent', key: 'emerald', points: 5, name: 'Emerald accent' },
  { kind: 'palette', key: 'goldclass', points: 12, name: 'Gold Class story palette' },
  { kind: 'accent', key: 'platinum', points: 20, name: 'Platinum accent' },
  { kind: 'palette', key: 'midnight', points: 30, name: 'Midnight story palette' },
];

const TIER_POINTS: Record<Tier, number> = { wood: 1, iron: 2, silver: 3, gold: 4, platinum: 5 };

export const achievementPoints = (list: Achievement[]) => list.reduce((sum, a) => sum + (a.tier ? TIER_POINTS[a.tier] : 0), 0);

/** Your points, and which perks they've unlocked. */
export function usePerks() {
  const { entries } = useDiary();
  const points = useMemo(() => achievementPoints(profileStats(entries, today()).achievements), [entries]);
  const perkFor = (kind: Perk['kind'], key: string) => PERKS.find((p) => p.kind === kind && p.key === key);
  return {
    points,
    /** True for anything that isn't a perk, or a perk you've earned. */
    unlocked: (kind: Perk['kind'], key: string) => {
      const perk = perkFor(kind, key);
      return !perk || points >= perk.points;
    },
    perkFor,
    next: PERKS.find((p) => p.points > points) ?? null,
  };
}
