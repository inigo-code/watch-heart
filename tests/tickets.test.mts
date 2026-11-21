import assert from 'node:assert/strict';
import { test } from 'node:test';

import { TICKET_CITIES, bookMyShowUrl, bookable, ticketCityName } from '../src/lib/tickets.ts';

test('a film can be booked from 30 days before it opens until six weeks after', () => {
  assert.equal(bookable('2026-11-22', '2026-11-22'), true);
  assert.equal(bookable('2026-12-22', '2026-11-22'), true);
  assert.equal(bookable('2026-12-23', '2026-11-22'), false);
  assert.equal(bookable('2026-10-11', '2026-11-22'), true);
  assert.equal(bookable('2026-10-10', '2026-11-22'), false);
  assert.equal(bookable(null, '2026-11-22'), false);
  assert.equal(bookable(undefined, '2026-11-22'), false);
});

test('links use BookMyShow’s name for the city', () => {
  assert.equal(bookMyShowUrl('chennai'), 'https://in.bookmyshow.com/explore/movies-chennai');
  assert.equal(bookMyShowUrl('national-capital-region-ncr'), 'https://in.bookmyshow.com/explore/movies-national-capital-region-ncr');
});

test('cities are named and unique, the ten popular ones first, each part A to Z', () => {
  assert.equal(ticketCityName('trivandrum'), 'Thiruvananthapuram');
  assert.equal(ticketCityName('national-capital-region-ncr'), 'Delhi-NCR');
  assert.equal(ticketCityName('nowhere'), null);
  const slugs = TICKET_CITIES.map((c) => c.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  const names = TICKET_CITIES.map((c) => c.name);
  const sorted = (l: string[]) => [...l].sort((a, b) => a.localeCompare(b));
  assert.deepEqual(names.slice(0, 10), sorted(names.slice(0, 10)));
  assert.deepEqual(names.slice(10), sorted(names.slice(10)));
  assert.ok(names.slice(0, 10).includes('Chennai') && names.slice(0, 10).includes('Delhi-NCR'));
  assert.ok(['mumbai', 'kochi'].every((s) => slugs.slice(0, 10).includes(s)));
  assert.ok(!slugs.slice(0, 10).includes('madurai'));
});
