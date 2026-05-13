import { filterItems, formatDate } from './news-utils.js';

const state = {
  items: [],
  suggestions: []
};

const elements = {
  search: document.getElementById('searchInput'),
  list: document.getElementById('newsList'),
  stats: document.getElementById('stats'),
  generatedAt: document.getElementById('generatedAt'),
  suggestions: document.getElementById('suggestions')
};

const render = () => {
  const filtered = filterItems(state.items, elements.search.value).slice(0, 100);
  elements.stats.textContent = `Showing ${filtered.length} of ${state.items.length} entries`;

  if (filtered.length === 0) {
    elements.list.innerHTML = '<p class="empty">No release notes match your search.</p>';
    return;
  }

  elements.list.innerHTML = filtered
    .map(
      (item) => `
        <article class="card">
          <div class="meta">
            <span>${item.category}</span>
            <span>${item.source}</span>
            <span>${formatDate(item.publishedAt)}</span>
          </div>
          <h3><a href="${item.link}" target="_blank" rel="noopener noreferrer">${item.title}</a></h3>
          <p>${item.summary || 'No summary available.'}</p>
        </article>
      `
    )
    .join('');
};

const renderSuggestions = () => {
  elements.suggestions.innerHTML = state.suggestions.map((value) => `<option value="${value}"></option>`).join('');
};

const loadJson = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status}`);
  }
  return response.json();
};

const init = async () => {
  const [news, suggestions] = await Promise.all([loadJson('./data/news.json'), loadJson('./data/suggestions.json')]);

  state.items = (news.items || []).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  state.suggestions = suggestions.values || [];

  elements.generatedAt.textContent = `Data refreshed: ${formatDate(news.generatedAt)}`;
  renderSuggestions();
  render();
};

elements.search.addEventListener('input', render);

init().catch((error) => {
  console.error(error);
  elements.list.innerHTML = `<p class="empty">Unable to load release news right now.</p>`;
});
