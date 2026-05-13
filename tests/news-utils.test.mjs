import assert from 'node:assert/strict';
import test from 'node:test';

import { filterItems, formatDate, buildDebugPanelHtml, categorySlug } from '../public/js/news-utils.js';

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
  assert.equal(categorySlug(''), '');
});
