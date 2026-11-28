// A review and its heading: one short line above the review, which the share card shows whole when a long
// review would be cut off. Plain logic, shared with watchheart.in and the tests.
import { plainText } from './richText';

/** How long a heading can be: a line, not a paragraph. */
export const HEADING_MAX = 80;

type Reviewed = { review: string; heading?: string | null };

/** The heading, tidied, or '' for none. */
export const headingOf = (e: Reviewed) => (e.heading ?? '').replace(/\s+/g, ' ').trim().slice(0, HEADING_MAX);

/** Whether there's anything written: a review, a heading, or both. */
export const hasReview = (e: Reviewed) => !!e.review.trim() || !!headingOf(e);

/** One line for a list: the heading when there is one, or else the review as plain words. */
export const reviewLine = (e: Reviewed) => headingOf(e) || plainText(e.review).replace(/\s+/g, ' ').trim();

// --- The Full review story card ------------------------------------------------------------------------------------
// Its words are in Courier Prime, where every letter is 0.6em wide, so how many lines a review takes at a size can be
// counted exactly. The card uses the largest size the review fits at, and below the smallest one that still reads on
// a phone it keeps as many words as fit and ends with "…".

/** The words' paragraphs: formatting marks off, spaces tidied, empty lines dropped. */
export const paragraphsOf = (review: string) =>
  plainText(review)
    .split(/\n+/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

/** How many lines `paragraphs` take with `cols` letters to a line, wrapping at spaces (a longer word is split). */
export function linesFor(paragraphs: string[], cols: number): number {
  let lines = 0;
  for (const p of paragraphs) {
    let used = 0;
    let n = 1;
    for (const word of p.split(' ')) {
      let w = word.length;
      if (used > 0 && used + 1 + w <= cols) {
        used += 1 + w;
        continue;
      }
      if (used > 0) n++;
      while (w > cols) {
        w -= cols;
        n++;
      }
      used = w;
    }
    lines += n;
  }
  return lines;
}

export type ReviewFit = { size: number; lineHeight: number; paragraphs: string[]; cut: boolean };

/**
 * The size for a review in a `width` × `height` box: the largest from `max` down to `min` (in half points) that it
 * fits at. If it doesn't fit even at `min`, as many words as fit, ending in "…", with `cut` set.
 */
export function fitReview(review: string, width: number, height: number, max = 15, min = 11): ReviewFit {
  const paragraphs = paragraphsOf(review);
  const at = (size: number) => {
    const lineHeight = Math.round(size * 1.45);
    // A little slack on the width, so the phone's own wrapping never needs a line the count didn't.
    return { lineHeight, cols: Math.floor((width * 0.97) / (size * 0.6)), rows: Math.floor(height / lineHeight) };
  };
  for (let size = max; size >= min; size -= 0.5) {
    const { lineHeight, cols, rows } = at(size);
    if (linesFor(paragraphs, cols) <= rows) return { size, lineHeight, paragraphs, cut: false };
  }
  const { lineHeight, cols, rows } = at(min);
  // The most words that fit with the "…": every paragraph's words in order, cut after the k-th.
  const words = paragraphs.flatMap((p, i) => p.split(' ').map((w, j) => ({ w, start: j === 0 && i > 0 })));
  const take = (k: number) => {
    const out: string[] = [];
    words.slice(0, k).forEach(({ w, start }) => (start || !out.length ? out.push(w) : (out[out.length - 1] += ` ${w}`)));
    if (out.length) out[out.length - 1] = `${out[out.length - 1].replace(/[\s,;:.!?-]+$/, '')}…`;
    return out;
  };
  let lo = 0;
  let hi = words.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (linesFor(take(mid), cols) <= rows) lo = mid;
    else hi = mid - 1;
  }
  return { size: min, lineHeight, paragraphs: take(lo), cut: true };
}
