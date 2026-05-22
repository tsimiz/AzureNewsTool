import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const sourcesPath = path.join(__dirname, 'news-sources.json');
const outputPath = path.join(repoRoot, 'public', 'data', 'news.json');
const suggestionsPath = path.join(repoRoot, 'public', 'data', 'suggestions.json');

const ARCHIVE_START_ISO = '2026-01-01T00:00:00.000Z';

const decode = (value = '') =>
  value
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*The post .+ appeared first on .+\s*\.?\s*$/, '')
    .trim();

const pickField = (block, names) => {
  for (const name of names) {
    const match = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'));
    if (match?.[1]) {
      return decode(match[1]);
    }
    const selfClosing = block.match(new RegExp(`<${name}[^>]*href=['\"]([^'\"]+)['\"][^>]*\\/?>(?:<\\/${name}>)?`, 'i'));
    if (selfClosing?.[1]) {
      return decode(selfClosing[1]);
    }
  }
  return '';
};

const safeDate = (value) => {
  const parsed = Date.parse(value || '');
  if (Number.isNaN(parsed)) {
    return null;
  }
  return new Date(parsed).toISOString();
};

const parseFeed = (xml, source) => {
  const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
  const entryBlocks = xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
  const blocks = itemBlocks.length > 0 ? itemBlocks : entryBlocks;

  return blocks
    .map((block) => {
      const title = pickField(block, ['title']);
      const link = pickField(block, ['link', 'id']);
      const summary = pickField(block, ['description', 'summary', 'content']);
      const publishedAt =
        safeDate(pickField(block, ['pubDate', 'published', 'updated', 'dc:date'])) || new Date().toISOString();

      if (!title || !link) {
        return null;
      }

      return {
        source: source.name,
        category: source.category,
        title,
        link,
        summary,
        publishedAt
      };
    })
    .filter(Boolean);
};

const buildSuggestions = (items, sources) => {
  const base = new Set([
    ...sources.map((s) => s.category),
    'AI',
    'Security',
    'Kubernetes',
    'Serverless',
    'Data',
    'DevOps'
  ]);

  for (const item of items.slice(0, 120)) {
    for (const token of item.title.split(/[^A-Za-z0-9+.#-]+/)) {
      const normalized = token.trim();
      if (normalized.length >= 4 && /^[A-Za-z][A-Za-z0-9+.-]*$/.test(normalized)) {
        base.add(normalized);
      }
    }
  }

  return [...base].sort((a, b) => a.localeCompare(b));
};

const main = async () => {
  const sources = JSON.parse(await readFile(sourcesPath, 'utf8'));

  const results = await Promise.all(
    sources.map(async (source) => {
      try {
        const response = await fetch(source.url, {
          headers: { 'user-agent': 'AzureNewsTool/1.0' }
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const xml = await response.text();
        return parseFeed(xml, source);
      } catch (error) {
        console.warn(`Skipping ${source.name}: ${error.message}`);
        return [];
      }
    })
  );

  const dedupe = new Map();

  // Load existing archive items as baseline (keeps accumulating over time)
  let existingItems = [];
  try {
    const existing = JSON.parse(await readFile(outputPath, 'utf8'));
    existingItems = Array.isArray(existing.items) ? existing.items : [];
  } catch {
    // No existing file yet; start fresh
  }
  for (const item of existingItems) {
    if (item.publishedAt >= ARCHIVE_START_ISO) {
      const key = `${item.link}|${item.title}`;
      dedupe.set(key, item);
    }
  }

  // New feed items override existing entries (fresher data takes precedence)
  for (const item of results.flat()) {
    if (item.publishedAt >= ARCHIVE_START_ISO) {
      const key = `${item.link}|${item.title}`;
      dedupe.set(key, item);
    }
  }

  const items = [...dedupe.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  const payload = {
    generatedAt: new Date().toISOString(),
    itemCount: items.length,
    sources,
    items
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  const suggestions = {
    generatedAt: payload.generatedAt,
    values: buildSuggestions(items, sources)
  };
  await writeFile(suggestionsPath, `${JSON.stringify(suggestions, null, 2)}\n`, 'utf8');

  console.log(`Wrote ${items.length} items to ${outputPath}`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
