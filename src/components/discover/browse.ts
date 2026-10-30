import { router } from 'expo-router';

import type { BrowseQuery } from '@/api/tmdb';

/** Opens the Discover grid for a query (a shelf, a list, a genre…); with `filters`, the filter sheet opens too. */
export const browse = (q: BrowseQuery, name: string, filters?: boolean) =>
  router.push({ pathname: '/browse', params: { q: JSON.stringify(q), name, ...(filters ? { filters: '1' } : {}) } });
