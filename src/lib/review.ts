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
