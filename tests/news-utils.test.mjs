import assert from 'node:assert/strict';
import test from 'node:test';

import { filterItems, formatDate } from '../public/js/news-utils.js';

test('filterItems finds by keyword and category', () => {
  const items = [
    { title: 'Azure Functions update', summary: 'Serverless release', category: 'Azure', source: 'Azure Updates' },
    { title: 'Defender change', summary: 'Security hardening', category: 'Security', source: 'Security Blog' }
  ];

  assert.equal(filterItems(items, 'serverless').length, 1);
  assert.equal(filterItems(items, 'security').length, 1);
  assert.equal(filterItems(items, '').length, 2);
});

test('formatDate handles invalid dates', () => {
  assert.equal(formatDate('not-a-date'), 'Unknown date');
});
