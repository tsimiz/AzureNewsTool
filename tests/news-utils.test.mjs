import assert from 'node:assert/strict';
import test from 'node:test';

import { filterItems, formatDate, buildDebugPanelHtml, categorySlug, filterByDateWindow, hasOlderItems } from '../public/js/news-utils.js';

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

test('buildDebugPanelHtml marks source with items as ok', () => {
  const sources = [{ name: 'Azure Updates', category: 'Azure', url: 'https://example.com/feed' }];
  const items = [{ source: 'Azure Updates', title: 'Test', summary: '', category: 'Azure', link: '#', publishedAt: '' }];
  const html = buildDebugPanelHtml(sources, items, '2024-01-01T00:00:00Z');

  assert.ok(html.includes('debug-ok'), 'source with items should have debug-ok class');
  assert.ok(html.includes('✅'), 'source with items should show checkmark');
  assert.ok(html.includes('1 item'), 'should show item count');
});

test('buildDebugPanelHtml marks source with no items as warning', () => {
  const sources = [{ name: 'Azure Blog', category: 'Azure', url: 'https://example.com/blog/feed' }];
  const html = buildDebugPanelHtml(sources, [], '2024-01-01T00:00:00Z');

  assert.ok(html.includes('debug-warn'), 'source with no items should have debug-warn class');
  assert.ok(html.includes('⚠️'), 'source with no items should show warning');
  assert.ok(html.includes('0 items'), 'should show zero item count');
});

test('buildDebugPanelHtml handles multiple sources', () => {
  const sources = [
    { name: 'Azure Updates', category: 'Azure', url: 'https://example.com/azure' },
    { name: 'Security Blog', category: 'Security', url: 'https://example.com/security' }
  ];
  const items = [
    { source: 'Azure Updates', title: 'A', summary: '', category: 'Azure', link: '#', publishedAt: '' },
    { source: 'Azure Updates', title: 'B', summary: '', category: 'Azure', link: '#', publishedAt: '' }
  ];
  const html = buildDebugPanelHtml(sources, items, '2024-01-01T00:00:00Z');

  assert.ok(html.includes('2 items'), 'Azure Updates should show 2 items');
  assert.ok(html.includes('0 items'), 'Security Blog should show 0 items');
});

test('buildDebugPanelHtml includes source URL as link', () => {
  const sources = [{ name: 'Azure Updates', category: 'Azure', url: 'https://example.com/feed' }];
  const html = buildDebugPanelHtml(sources, [], '2024-01-01T00:00:00Z');

  assert.ok(html.includes('href="https://example.com/feed"'), 'should include feed URL as link');
});

test('categorySlug converts category names to CSS-safe slugs', () => {
  assert.equal(categorySlug('Azure'), 'azure');
  assert.equal(categorySlug('Microsoft 365'), 'microsoft-365');
  assert.equal(categorySlug('Power Platform'), 'power-platform');
  assert.equal(categorySlug('Security'), 'security');
  assert.equal(categorySlug('Developer'), 'developer');
  assert.equal(categorySlug(''), '');
});

test('filterByDateWindow returns only items on or after the cutoff date', () => {
  const now = new Date();
  const recentDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
  const oldDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const items = [
    { title: 'Recent item', publishedAt: recentDate },
    { title: 'Old item', publishedAt: oldDate }
  ];

  const result = filterByDateWindow(items, cutoff);
  assert.equal(result.length, 1);
  assert.equal(result[0].title, 'Recent item');
});

test('filterByDateWindow accepts a date string as cutoff', () => {
  const cutoffStr = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const recentDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
  const items = [{ title: 'Recent', publishedAt: recentDate }];

  const result = filterByDateWindow(items, cutoffStr);
  assert.equal(result.length, 1);
});

test('filterByDateWindow excludes items with invalid publishedAt', () => {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const items = [
    { title: 'Valid recent', publishedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() },
    { title: 'Invalid date', publishedAt: 'not-a-date' }
  ];

  const result = filterByDateWindow(items, cutoff);
  assert.equal(result.length, 1);
  assert.equal(result[0].title, 'Valid recent');
});

test('hasOlderItems returns true when items exist between archiveStart and cutoff', () => {
  const now = new Date();
  const archiveStart = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const recentDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
  const olderDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();

  const items = [
    { title: 'Recent', publishedAt: recentDate },
    { title: 'Older', publishedAt: olderDate }
  ];

  assert.equal(hasOlderItems(items, cutoff, archiveStart), true);
});

test('hasOlderItems returns false when no items exist before cutoff within archive range', () => {
  const now = new Date();
  const archiveStart = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const recentDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();

  const items = [{ title: 'Recent', publishedAt: recentDate }];

  assert.equal(hasOlderItems(items, cutoff, archiveStart), false);
});

test('hasOlderItems returns false when older items are before archiveStart', () => {
  const now = new Date();
  const archiveStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const cutoff = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
  const veryOldDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();

  const items = [{ title: 'Very old', publishedAt: veryOldDate }];

  assert.equal(hasOlderItems(items, cutoff, archiveStart), false);
});
