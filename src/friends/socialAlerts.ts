import { storage } from '@/lib/storage';
import { unannounced } from '@/lib/socialNews';
import type { SocialNews } from '@/lib/socialNews';

import { socialNews } from './socialApi';

// Which likes and comments this phone has already mentioned, so the background check only announces new
// ones. The Friends page marks what it shows as known too.

const KEY = 'watchheart/social-alerts';

async function seen(): Promise<string[] | null> {
  const raw = await storage.getItem(KEY).catch(() => null);
  if (!raw) return null;
  try {
    const ids = JSON.parse(raw) as unknown;
    return Array.isArray(ids) ? ids.filter((i): i is string => typeof i === 'string') : [];
  } catch {
    return [];
  }
}

/** Marks these as known. */
export async function rememberSocial(news: SocialNews[]) {
  const { remember } = unannounced(news, (await seen()) ?? []);
  await storage.setItem(KEY, JSON.stringify(remember)).catch(() => {});
}

/** New likes and comments since last time, and remembers them. The first time, nothing is new. */
export async function freshSocial(): Promise<SocialNews[]> {
  const known = await seen();
  const news = await socialNews(null);
  const { fresh, remember } = unannounced(news, known ?? []);
  await storage.setItem(KEY, JSON.stringify(remember)).catch(() => {});
  return known ? fresh : [];
}
