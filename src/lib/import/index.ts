import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { gunzipSync, strFromU8, unzipSync } from 'fflate';
import { Platform } from 'react-native';

import type { Entry, WatchItem } from '@/store/types';

import { records } from './common';
import type { ImportResult } from './common';
import { fromGenericCsv, fromGenericJson } from './generic';
import { fromImdb, imdbKind } from './imdb';
import { letterboxdFile, fromLetterboxd } from './letterboxd';
import type { LetterboxdFile } from './letterboxd';
import { fromMal, isMalXml } from './mal';
import { fromNetflix, isNetflix } from './netflix';
import { fromTrakt, traktKind } from './trakt';
import type { TraktFile } from './trakt';

// One importer for every app: pick whatever the other app exported (a .zip as it comes, CSVs, JSON,
// a MyAnimeList .xml.gz) and each file is recognised by its name and contents.

export type SourceReport = { source: string; entries: number; watchlist: number; note?: string };
export type ImportBundle = { entries: Entry[]; watchlist: WatchItem[]; sources: SourceReport[]; unreadable: string[] };

type Picked = { name: string; bytes: Uint8Array };

const isZip = (b: Uint8Array) => b[0] === 0x50 && b[1] === 0x4b;
const isGzip = (b: Uint8Array) => b[0] === 0x1f && b[1] === 0x8b;

/** Unpacks zips and gzip files into the files inside them (zip paths kept, so folders still count). */
function expand(files: Picked[]): Picked[] {
  return files.flatMap((f) => {
    if (isZip(f.bytes)) {
      const inside = unzipSync(f.bytes, { filter: (e) => !e.name.endsWith('/') && /\.(csv|json|xml|txt|gz)$/i.test(e.name) });
      return expand(Object.entries(inside).map(([name, bytes]) => ({ name, bytes })));
    }
    if (isGzip(f.bytes)) return expand([{ name: f.name.replace(/\.gz$/i, ''), bytes: gunzipSync(f.bytes) }]);
    return [f];
  });
}

/** Which app a file probably came from, for apps without a recognisable format of their own. */
function appFromName(name: string): string {
  const n = name.toLowerCase();
  for (const app of ['refract', 'serializd', 'moviebase', 'tvtime', 'tv time', 'simkl', 'justwatch', 'letterboxd', 'trakt']) {
    if (n.includes(app)) return app.replace(' ', '');
  }
  return 'file';
}

const LABELS: Record<string, string> = {
  refract: 'Refract',
  serializd: 'Serializd',
  moviebase: 'Moviebase',
  tvtime: 'TV Time',
  simkl: 'Simkl',
  justwatch: 'JustWatch',
  file: 'Other app',
};

/** Reads picked files into diary entries and watchlist items. Pure apart from parsing, so it's easy to check. */
export function readImport(picked: Picked[]): ImportBundle {
  const bundle: ImportBundle = { entries: [], watchlist: [], sources: [], unreadable: [] };
  const add = (source: string, r: ImportResult | null, note?: string) => {
    if (!r || (!r.entries.length && !r.watchlist.length)) return false;
    bundle.entries.push(...r.entries);
    bundle.watchlist.push(...r.watchlist);
    const existing = bundle.sources.find((s) => s.source === source);
    if (existing) {
      existing.entries += r.entries.length;
      existing.watchlist += r.watchlist.length;
    } else bundle.sources.push({ source, entries: r.entries.length, watchlist: r.watchlist.length, note });
    return true;
  };

  const letterboxd: Partial<Record<LetterboxdFile, string>> = {};
  const trakt: Partial<Record<TraktFile, unknown[]>> = {};

  for (const f of expand(picked)) {
    const text = strFromU8(f.bytes).replace(/^﻿/, '');
    const base = f.name.split(/[\\/]/).pop() ?? f.name;
    const lower = f.name.toLowerCase();

    if (/\.xml$/i.test(lower) || text.trimStart().startsWith('<')) {
      if (isMalXml(text) && add('MyAnimeList', fromMal(text))) continue;
      bundle.unreadable.push(base);
      continue;
    }

    if (/\.json$/i.test(lower) || /^\s*[[{]/.test(text)) {
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        bundle.unreadable.push(base);
        continue;
      }
      const tk = traktKind(json);
      if (tk) {
        trakt[tk] = [...(trakt[tk] ?? []), ...(json as unknown[])];
        continue;
      }
      // Our own backup, picked here by mistake: say so rather than half-import it.
      if ((json as { format?: string })?.format === 'watchheart-backup') {
        bundle.unreadable.push(`${base} (a Watch Heart backup: use Import backup)`);
        continue;
      }
      const app = appFromName(f.name);
      if (!add(LABELS[app] ?? app, fromGenericJson(json, app))) bundle.unreadable.push(base);
      continue;
    }

    // Letterboxd's lists and other extras start with a line like "Letterboxd list export v7": not diary data.
    if (/^Letterboxd /.test(text)) continue;

    // CSV (or text that might be).
    const { headers } = records(text.slice(0, 4000));
    const lb = letterboxdFile(f.name);
    if (lb && headers.includes('Name') && (headers.includes('Letterboxd URI') || lb === 'likes/films.csv')) {
      letterboxd[lb] = text;
      continue;
    }
    if (headers.includes('Letterboxd URI')) continue; // other Letterboxd files (deleted/, lists/, comments…)
    if (imdbKind(headers)) {
      add('IMDb', fromImdb(text));
      continue;
    }
    if (isNetflix(headers)) {
      const r = fromNetflix(text);
      add('Netflix', r, r.skippedProfiles?.length ? `Profile “${r.profile}” (others left out: ${r.skippedProfiles.join(', ')})` : undefined);
      continue;
    }
    const app = appFromName(f.name);
    if (!add(LABELS[app] ?? app, fromGenericCsv(text, app))) bundle.unreadable.push(base);
  }

  if (Object.keys(letterboxd).length) add('Letterboxd', fromLetterboxd(letterboxd));
  if (Object.keys(trakt).length) add('Trakt', fromTrakt(trakt));

  // The same title can arrive from two files of one export; keep each id once.
  const seen = new Set<string>();
  bundle.entries = bundle.entries.filter((e) => !seen.has(e.id) && !!seen.add(e.id));
  bundle.watchlist = bundle.watchlist.filter((w) => !seen.has(w.id) && !!seen.add(w.id));
  return bundle;
}

async function bytesOf(uri: string): Promise<Uint8Array> {
  if (Platform.OS === 'web') return new Uint8Array(await (await fetch(uri)).arrayBuffer());
  return new File(uri).bytes();
}

/** Lets you pick one or more export files and reads them. Null if cancelled. */
export async function pickImport(): Promise<ImportBundle | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: true, copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.length) return null;
  const picked: Picked[] = [];
  for (const asset of res.assets) picked.push({ name: asset.name ?? 'file', bytes: await bytesOf(asset.uri) });
  return readImport(picked);
}
