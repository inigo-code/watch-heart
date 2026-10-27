import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { APP_NAME, APP_SLUG } from '@/lib/app';
import type { Entry, WatchItem } from '@/store/types';

const FORMAT = 'watchheart-backup';
const FORMAT_VERSION = 1;

export type Backup = {
  format: typeof FORMAT;
  version: number;
  exportedAt: string;
  entries: Entry[];
  /** Added after the first release; older backups have none. */
  watchlist?: WatchItem[];
};

const stamp = () => new Date().toISOString().slice(0, 10);

async function share(name: string, contents: string, mimeType: string, dialogTitle: string) {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([contents], { type: mimeType }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  await file.write(contents);
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle });
}

/** The whole diary (Trash included, so a restore brings it back too) and the watchlist, as one JSON file. */
export async function exportBackup(entries: Entry[], watchlist: WatchItem[]) {
  const backup: Backup = { format: FORMAT, version: FORMAT_VERSION, exportedAt: new Date().toISOString(), entries, watchlist };
  await share(`${APP_SLUG}-backup-${stamp()}.json`, JSON.stringify(backup), 'application/json', `Save ${APP_NAME} backup`);
}

const csvCell = (v: string | number | null) => {
  const s = v === null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (rows: (string | number | null)[][]) => rows.map((r) => r.map(csvCell).join(',')).join('\n');

/**
 * Films in Letterboxd's import format (letterboxd.com/import), so the diary can move there any time.
 * Series and anime are left out: Letterboxd only logs films.
 */
export async function exportLetterboxd(entries: Entry[]): Promise<number> {
  const films = entries.filter((e) => e.kind === 'movie');
  const rows = films.map((e) => [
    e.title,
    e.year,
    e.source === 'tmdb' ? e.sourceId.split(':')[1] : null,
    e.watchedOn,
    e.rating ? e.rating / 2 : null,
    e.rewatch ? 'true' : 'false',
    e.tags.join(', '),
    e.review,
  ]);
  await share(
    `${APP_SLUG}-letterboxd-${stamp()}.csv`,
    csv([['Title', 'Year', 'tmdbID', 'WatchedDate', 'Rating', 'Rewatch', 'Tags', 'Review'], ...rows]),
    'text/csv',
    'Export for Letterboxd',
  );
  return films.length;
}

/** Everything as a spreadsheet: one row per viewing. */
export async function exportCsv(entries: Entry[]) {
  const rows = entries.map((e) => [
    e.watchedOn,
    e.kind,
    e.title,
    e.year,
    e.rating ? e.rating / 2 : null,
    e.liked ? 'yes' : '',
    e.rewatch ? 'yes' : '',
    e.progress,
    e.genres.join(', '),
    e.runtime,
    e.tags.join(', '),
    e.review,
  ]);
  await share(
    `${APP_SLUG}-diary-${stamp()}.csv`,
    csv([['Watched', 'Kind', 'Title', 'Year', 'Rating', 'Liked', 'Rewatch', 'Progress', 'Genres', 'Minutes', 'Tags', 'Review'], ...rows]),
    'text/csv',
    'Export diary',
  );
}

/** Lets you pick a backup file; returns null if cancelled. Throws on files that aren't backups. */
export async function pickBackup(): Promise<Backup | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.[0]) return null;
  const asset = res.assets[0];
  const text = Platform.OS === 'web' ? await (await fetch(asset.uri)).text() : await new File(asset.uri).text();

  let data: Backup;
  try {
    data = JSON.parse(text) as Backup;
  } catch {
    throw new Error("That file isn't a valid backup (it isn't JSON).");
  }
  if (data.format !== FORMAT || !Array.isArray(data.entries)) throw new Error(`That file isn't a ${APP_NAME} backup.`);
  if (data.version > FORMAT_VERSION) throw new Error('That backup was made by a newer version of the app. Update first.');
  return data;
}
