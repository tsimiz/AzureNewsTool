# GitHub Instructions for Future Agents

This repository is a static Azure news aggregator. Keep changes focused, minimal, and consistent with the existing vanilla JS architecture.

## Project map

- `public/index.html` — app shell and filter controls
- `public/js/app.js` — UI state, rendering, filtering, animations
- `public/js/news-utils.js` — pure helpers used by app and tests
- `scripts/fetch-news.mjs` — RSS/Atom ingestion and JSON generation
- `scripts/news-sources.json` — source registry
- `public/data/news.json` — generated aggregated data
- `public/data/suggestions.json` — generated autocomplete terms
- `tests/news-utils.test.mjs` — Node test suite
- `.github/workflows/update-news.yml` — scheduled data refresh
- `.github/workflows/azure-static-web-apps-*.yml` — deployment workflow

## Commands

- `npm test` — run all tests (`node --test`)
- `npm run fetch-news` — regenerate `public/data/*.json`
- Local preview: `python3 -m http.server 8080 --directory public`

Run tests before finishing any code change. If feed parsing/sources/data logic changes, also run `npm run fetch-news`.

## Working rules for this repo

1. Prefer editing `public/js/news-utils.js` for reusable logic; keep `app.js` for orchestration and DOM behavior.
2. Do not manually hand-edit generated files in `public/data/` unless the task is explicitly about fixture-style data edits.
3. Keep archive window behavior aligned between:
   - `scripts/fetch-news.mjs` (`ARCHIVE_START_ISO`)
   - `public/js/app.js` (`ARCHIVE_START`)
4. Preserve existing UX patterns: category/subcategory filtering, date-window paging (“Older”), dark mode, and debug panel (`?debug`).
5. Keep code ES module style and avoid introducing frameworks/build tooling unless explicitly requested.
6. Keep error handling explicit; do not swallow errors silently.

## When changing feeds or ingestion

1. Update `scripts/news-sources.json`.
2. Ensure parser compatibility in `scripts/fetch-news.mjs` (RSS `<item>` and Atom `<entry>` handling).
3. Regenerate data with `npm run fetch-news`.
4. Confirm app still renders with new data shape (items sorted by `publishedAt`, required fields present).

## Testing expectations

- Add/update tests in `tests/news-utils.test.mjs` when changing utility behavior.
- Keep tests deterministic and focused on pure functions where possible.
- Avoid introducing network-dependent tests.

## CI/CD notes

- Data refresh workflow commits only when `public/data/news.json` or `public/data/suggestions.json` changed.
- Static Web Apps workflow deploys from `./public`.
- Do not rename workflow files, secrets, or deployment token keys unless explicitly requested.
