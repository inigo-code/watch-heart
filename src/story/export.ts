/**
 * Stories are laid out at 360×640 points and exported at 1440×2560 pixels: four pixels to a point, whatever
 * the phone's own density, so text stays sharp and Instagram gets more than it needs.
 */
export const EXPORT_W = 1440;
export const EXPORT_H = 2560;
const PX_PER_POINT = 4;

const POSTER_SIZES = [185, 342, 500, 780];

/** A TMDB image at the smallest size that stays sharp drawn `w` story points wide (other images as they are). */
export function sharp<T extends string | null | undefined>(url: T, w: number): T | string {
  const m = url?.match(/^(https:\/\/image\.tmdb\.org\/t\/p\/)w\d+(\/.+)$/);
  if (!m) return url;
  const need = w * PX_PER_POINT;
  // Wider than any poster size: a backdrop across the story.
  const size = need > 780 ? 'w1280' : `w${POSTER_SIZES.find((s) => s >= need) ?? 780}`;
  return `${m[1]}${size}${m[2]}`;
}
