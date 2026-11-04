import { today } from '@/lib/dates';
import type { EntryDraft, Title } from '@/store/types';

/** A diary entry for this title, not filled in yet, watched today. */
export function blankDraft(t: Title): EntryDraft {
  return {
    kind: t.kind,
    source: t.source,
    sourceId: t.sourceId,
    title: t.title,
    originalTitle: t.originalTitle ?? null,
    year: t.year,
    posterUrl: t.posterUrl,
    backdropUrl: t.backdropUrl,
    genres: t.genres,
    runtime: t.runtime,
    credit: t.credit ?? null,
    watchedOn: today(),
    rating: 0,
    liked: false,
    rewatch: false,
    progress: '',
    review: '',
    spoilers: false,
    tags: [],
    fetchedAt: t.source === 'tmdb' ? (t.fetchedAt ?? Date.now()) : null,
  };
}
