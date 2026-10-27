import type { Title } from '@/store/types';

// AniList: free GraphQL API, no key needed (about 90 requests a minute).

const URL = 'https://graphql.anilist.co';

const FIELDS = `
  id
  title { romaji english native }
  startDate { year }
  coverImage { extraLarge large }
  bannerImage
  description(asHtml: false)
  episodes
  duration
  genres
  format
  studios(isMain: true) { nodes { name } }
`;

const SEARCH = `query ($search: String) {
  Page(perPage: 25) { media(search: $search, type: ANIME, isAdult: false, sort: SEARCH_MATCH) { ${FIELDS} } }
}`;

const BY_ID = `query ($id: Int, $idMal: Int) {
  Media(id: $id, idMal: $idMal, type: ANIME) { ${FIELDS} }
}`;

const TRENDING = `query {
  Page(perPage: 25) { media(type: ANIME, isAdult: false, sort: TRENDING_DESC) { ${FIELDS} } }
}`;

type Media = {
  id: number;
  title: { romaji: string | null; english: string | null; native: string | null };
  startDate: { year: number | null };
  coverImage: { extraLarge: string | null; large: string | null };
  bannerImage: string | null;
  description: string | null;
  episodes: number | null;
  duration: number | null;
  genres: string[];
  format: string | null;
  studios: { nodes: { name: string }[] };
};

/** AniList descriptions carry a little HTML (<br>, <i>); show them as plain text. */
const plain = (s: string | null) => (s ?? '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/\n{3,}/g, '\n\n').trim();

function toTitle(m: Media): Title {
  const title = m.title.english || m.title.romaji || m.title.native || 'Untitled';
  const original = m.title.romaji && m.title.romaji !== title ? m.title.romaji : undefined;
  return {
    kind: 'anime',
    source: 'anilist',
    sourceId: String(m.id),
    title,
    originalTitle: original,
    year: m.startDate.year,
    posterUrl: m.coverImage.extraLarge || m.coverImage.large,
    backdropUrl: m.bannerImage,
    overview: plain(m.description),
    genres: m.genres,
    runtime: m.duration,
    episodes: m.episodes,
    credit: m.studios.nodes[0]?.name ?? null,
  };
}

async function query(body: object, signal?: AbortSignal): Promise<Title[]> {
  const res = await fetch(URL, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 429) throw new Error('AniList needs a short break. Try again in a minute.');
  if (!res.ok) throw new Error(`AniList is having trouble (${res.status}). Try again in a moment.`);
  const json = (await res.json()) as { data?: { Page: { media: Media[] } } };
  return (json.data?.Page.media ?? []).map(toTitle);
}

export const searchAnime = (search: string, signal?: AbortSignal) => query({ query: SEARCH, variables: { search } }, signal);
export const trendingAnime = (signal?: AbortSignal) => query({ query: TRENDING }, signal);

/** One anime by its AniList id, or by its MyAnimeList id. Null when there's no such anime. */
export async function animeById(ids: { id?: number; idMal?: number }, signal?: AbortSignal): Promise<Title | null> {
  const res = await fetch(URL, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query: BY_ID, variables: ids }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { data?: { Media: Media | null } };
  return json.data?.Media ? toTitle(json.data.Media) : null;
}
