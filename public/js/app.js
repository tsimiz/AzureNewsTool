import { filterItems, formatDate, buildDebugPanelHtml, categorySlug, getSubcategory, filterByDateWindow, hasOlderItems } from './news-utils.js';

const WINDOW_DAYS = 30;
const ARCHIVE_START = new Date('2026-01-01T00:00:00.000Z');

const state = {
  items: [],
  suggestions: [],
  activeCategory: '',
  activeSubcategory: '',
  visibleWindows: 1
};

const elements = {
  search: document.getElementById('searchInput'),
  list: document.getElementById('newsList'),
  stats: document.getElementById('stats'),
  generatedAt: document.getElementById('generatedAt'),
  suggestions: document.getElementById('suggestions'),
  darkModeToggle: document.getElementById('darkModeToggle'),
  aiSettingsBtn: document.getElementById('aiSettingsBtn'),
  aiModal: document.getElementById('aiModal'),
  aiEndpoint: document.getElementById('aiEndpoint'),
  aiDeployment: document.getElementById('aiDeployment'),
  aiKey: document.getElementById('aiKey'),
  aiModalSave: document.getElementById('aiModalSave'),
  aiModalCancel: document.getElementById('aiModalCancel'),
  debugPanel: document.getElementById('debugPanel'),
  topicBtns: document.querySelectorAll('.topic-btn'),
  subcategoryFilters: document.getElementById('subcategoryFilters'),
  olderContainer: document.getElementById('olderContainer'),
  olderBtn: document.getElementById('olderBtn')
};

const isDebugMode = new URLSearchParams(location.search).has('debug');

// ── Dark mode ──────────────────────────────────────────────────────────────

const applyDark = (dark) => {
  document.documentElement.classList.toggle('dark', dark);
  elements.darkModeToggle.textContent = dark ? '☀️' : '🌙';
  elements.darkModeToggle.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
};

const initDarkMode = () => {
  const stored = localStorage.getItem('darkMode');
  const prefersDark = stored !== null ? stored === 'true' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyDark(prefersDark);
};

elements.darkModeToggle.addEventListener('click', () => {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('darkMode', isDark);
  elements.darkModeToggle.textContent = isDark ? '☀️' : '🌙';
  elements.darkModeToggle.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
});

// ── AI Settings modal ──────────────────────────────────────────────────────

const AI_CONFIG_KEY = 'azureAiConfig';

const loadAiConfig = () => {
  try {
    return JSON.parse(localStorage.getItem(AI_CONFIG_KEY) || '{}');
  } catch {
    return {};
  }
};

const openAiModal = () => {
  const cfg = loadAiConfig();
  elements.aiEndpoint.value = cfg.endpoint || '';
  elements.aiDeployment.value = cfg.deployment || '';
  elements.aiKey.value = cfg.key || '';
  elements.aiModal.classList.add('open');
  elements.aiEndpoint.focus();
};

const closeAiModal = () => {
  elements.aiModal.classList.remove('open');
};

elements.aiSettingsBtn.addEventListener('click', openAiModal);
elements.aiModalCancel.addEventListener('click', closeAiModal);
elements.aiModal.addEventListener('click', (e) => { if (e.target === elements.aiModal) closeAiModal(); });

elements.aiModalSave.addEventListener('click', () => {
  const cfg = {
    endpoint: elements.aiEndpoint.value.trim().replace(/\/+$/, ''),
    deployment: elements.aiDeployment.value.trim(),
    key: elements.aiKey.value.trim()
  };
  localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(cfg));
  closeAiModal();
});

// ── AI summarisation ────────────────────────────────────────────────────────

const summariseWithAi = async (title, summary) => {
  const cfg = loadAiConfig();
  if (!cfg.endpoint || !cfg.deployment || !cfg.key) {
    openAiModal();
    throw new Error('Please configure your Azure AI Foundry settings first.');
  }

  const url = `${cfg.endpoint}/openai/deployments/${encodeURIComponent(cfg.deployment)}/chat/completions?api-version=2024-02-01`;
  const body = {
    messages: [
      {
        role: 'system',
        content:
          'You are a helpful assistant that creates concise, informative summaries of Azure and Microsoft technology news. Focus on the most important and interesting aspects. Keep the summary to 2-3 sentences.'
      },
      {
        role: 'user',
        content: `Please summarise the following news article.\n\nTitle: ${title}\n\nContent: ${summary}`
      }
    ],
    max_completion_tokens: 200,
    temperature: 0.5
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': cfg.key
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Azure AI request failed (${response.status}): ${err}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || 'No summary returned.';
};

// ── Debug panel ────────────────────────────────────────────────────────────

export const renderDebugPanel = (sources, items, generatedAt) => {
  elements.debugPanel.hidden = false;
  elements.debugPanel.innerHTML = buildDebugPanelHtml(sources, items, generatedAt);
};

// ── Rendering ──────────────────────────────────────────────────────────────

const renderSubcategoryFilters = (categoryItems) => {
  const subEl = elements.subcategoryFilters;
  if (!state.activeCategory) {
    subEl.hidden = true;
    return;
  }
  const available = [...new Set(categoryItems.map(getSubcategory).filter(Boolean))];
  if (available.length === 0) {
    subEl.hidden = true;
    return;
  }
  subEl.hidden = false;
  subEl.innerHTML = available
    .map((s) => {
      const slug = categorySlug(s);
      const isActive = state.activeSubcategory === slug;
      return `<button class="subcategory-btn${isActive ? ' active' : ''}" data-subcategory="${slug}">${s}</button>`;
    })
    .join('');
  subEl.querySelectorAll('.subcategory-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.activeSubcategory = btn.dataset.subcategory === state.activeSubcategory ? '' : btn.dataset.subcategory;
      state.visibleWindows = 1;
      render();
    });
  });
};

const render = () => {
  const windowCutoff = new Date(Date.now() - state.visibleWindows * WINDOW_DAYS * 24 * 60 * 60 * 1000);

  let filtered = filterItems(state.items, elements.search.value);
  if (state.activeCategory) {
    filtered = filtered.filter((item) => categorySlug(item.category) === state.activeCategory);
  }

  // Render subcategory pills based on category-filtered items (before subcategory filter)
  renderSubcategoryFilters(filtered);

  if (state.activeSubcategory) {
    filtered = filtered.filter((item) => categorySlug(getSubcategory(item)) === state.activeSubcategory);
  }

  const visibleItems = filterByDateWindow(filtered, windowCutoff);
  const showOlder = hasOlderItems(filtered, windowCutoff, ARCHIVE_START);

  elements.stats.textContent = `Showing ${visibleItems.length} of ${state.items.length} entries`;
  elements.olderContainer.hidden = !showOlder;

  if (visibleItems.length === 0) {
    elements.list.innerHTML = showOlder
      ? `<p class="empty">No entries in the past ${state.visibleWindows * WINDOW_DAYS} days. Click "Older" below to load earlier entries.</p>`
      : '<p class="empty">No release notes match your search.</p>';
    return;
  }

  elements.list.innerHTML = visibleItems
    .map(
      (item, index) => {
        const subcat = getSubcategory(item);
        const subcatSlug = subcat ? categorySlug(subcat) : '';
        const subcatHtml = subcat
          ? `<button class="meta-tag meta-subcategory meta-subcategory--${subcatSlug}" data-subcategory="${subcatSlug}">${subcat}</button>`
          : '';
        return `
        <article class="card" data-index="${index}" data-category="${categorySlug(item.category)}">
          <div class="meta">
            <button class="meta-tag meta-category" data-category="${categorySlug(item.category)}">${item.category}</button>
            ${subcatHtml}
            <span>${item.source}</span>
            <span>${formatDate(item.publishedAt)}</span>
          </div>
          <h3><a href="${item.link}" target="_blank" rel="noopener noreferrer">${item.title}</a></h3>
          <p>${item.summary || 'No summary available.'}</p>
          <div class="card-footer">
            <button class="btn-ai" data-index="${index}" title="Generate an AI summary using Azure AI Foundry">✨ Summarize with AI</button>
          </div>
          <div class="ai-summary" id="ai-summary-${index}" aria-live="polite" hidden></div>
        </article>
      `;
      }
    )
    .join('');

  elements.list.querySelectorAll('.meta-category').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.activeCategory = btn.dataset.category;
      state.activeSubcategory = '';
      state.visibleWindows = 1;
      elements.topicBtns.forEach((b) => b.classList.toggle('active', b.dataset.category === state.activeCategory));
      render();
    });
  });

  elements.list.querySelectorAll('.meta-subcategory').forEach((btn) => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.card');
      state.activeCategory = card.dataset.category;
      state.activeSubcategory = btn.dataset.subcategory === state.activeSubcategory ? '' : btn.dataset.subcategory;
      state.visibleWindows = 1;
      elements.topicBtns.forEach((b) => b.classList.toggle('active', b.dataset.category === state.activeCategory));
      render();
    });
  });

  elements.list.querySelectorAll('.btn-ai').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const index = Number(btn.dataset.index);
      const item = visibleItems[index];
      const summaryEl = document.getElementById(`ai-summary-${index}`);

      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
      btn.textContent = '⏳ Summarizing…';
      summaryEl.hidden = false;
      summaryEl.innerHTML = '<span class="ai-summary-label">AI Summary</span>Generating summary…';

      try {
        const result = await summariseWithAi(item.title, item.summary || item.title);
        summaryEl.innerHTML = `<span class="ai-summary-label">✨ AI Summary</span>${result}`;
        btn.textContent = '✨ Regenerate';
      } catch (err) {
        summaryEl.innerHTML = `<span class="ai-error">⚠ ${err.message}</span>`;
        btn.textContent = '✨ Summarize with AI';
      } finally {
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
      }
    });
  });
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
  initDarkMode();

  const [news, suggestions] = await Promise.all([loadJson('./data/news.json'), loadJson('./data/suggestions.json')]);

  state.items = (news.items || []).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  state.suggestions = suggestions.values || [];

  elements.generatedAt.textContent = `Data refreshed: ${formatDate(news.generatedAt)}`;

  if (isDebugMode) {
    renderDebugPanel(news.sources || [], state.items, news.generatedAt);
  }

  renderSuggestions();
  render();
};

elements.topicBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    state.activeCategory = btn.dataset.category;
    state.activeSubcategory = '';
    state.visibleWindows = 1;
    elements.topicBtns.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    render();
  });
});

elements.search.addEventListener('input', () => {
  state.visibleWindows = 1;
  render();
});

elements.olderBtn.addEventListener('click', () => {
  state.visibleWindows += 1;
  render();
});

init().catch((error) => {
  console.error(error);
  elements.list.innerHTML = `<p class="empty">Unable to load release news right now.</p>`;
});
