# AzureNewsTool

AzureNewsTool is an Azure-inspired static web app that aggregates Microsoft and Azure release announcements from multiple RSS/Atom sources, supports keyword search with autocomplete, and is ready for Azure Static Web Apps CI/CD.

## Feed sources currently configured

- Azure Updates — `https://azure.microsoft.com/en-us/updates/feed/`
- Azure Blog — `https://azure.microsoft.com/en-us/blog/feed/`
- Microsoft Security Blog — `https://www.microsoft.com/en-us/security/blog/feed/`
- Microsoft 365 Blog — `https://www.microsoft.com/en-us/microsoft-365/blog/feed/`
- Power Platform Blog — `https://www.microsoft.com/en-us/power-platform/blog/feed/`

Source definitions live in `/scripts/news-sources.json`.

## Project structure

- `/public/index.html` – UI shell
- `/public/css/styles.css` – Azure-inspired styling
- `/public/js/app.js` – rendering, loading, filtering
- `/public/js/news-utils.js` – shared search/date logic
- `/public/data/news.json` – cached aggregated news data
- `/public/data/suggestions.json` – autocomplete keywords/categories
- `/scripts/fetch-news.mjs` – RSS/Atom aggregation script
- `/.github/workflows/update-news.yml` – scheduled data refresh every 6h
- `/.github/workflows/azure-static-web-apps.yml` – Azure Static Web Apps deployment workflow

## Local usage

```bash
npm run fetch-news
python3 -m http.server 8080 --directory public
```

Open `http://localhost:8080`.

## Search & UX

- Most recent posts are shown first.
- Keyword search runs across title, summary, category, and source.
- Autocomplete suggestions come from category names + common terms in recent titles.

## Lowest-cost data option

For the cheapest architecture, keep data as versioned JSON files in GitHub (current implementation) and let scheduled GitHub Actions refresh them.

If a database is needed later, the lowest-cost Azure option for this workload is typically **Azure Table Storage (StorageV2, LRS, pay-as-you-go)** due to very low storage and transaction pricing compared to managed database services.

## Azure deployment

1. Create an Azure Static Web App.
2. Add repository secret `AZURE_STATIC_WEB_APPS_API_TOKEN`.
3. Ensure default branch is `main` (or adjust workflow branch filters).
4. Push changes; deployment runs automatically.
