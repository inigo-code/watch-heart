import assert from 'node:assert/strict';
import { test } from 'node:test';

import { countryName, inCountry } from '../src/lib/discover.ts';

test('countries are named without Intl.DisplayNames, as on phones', () => {
  assert.equal(countryName('IN'), 'India');
  assert.equal(countryName('us'), 'United States');
  assert.equal(inCountry('IN'), 'India');
  assert.equal(inCountry('GB'), 'the United Kingdom');
  assert.equal(inCountry('NL'), 'the Netherlands');
});
