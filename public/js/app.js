import { formatDate, buildDebugPanelHtml, categorySlug, getSubcategory, filterByDateWindow, hasOlderItems } from './news-utils.js';

const WINDOW_DAYS = 30;
const ARCHIVE_START = new Date('2026-01-01T00:00:00.000Z');
const FLIP_DURATION_MS = 320;
const FADE_OUT_MS = 150;

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

// ── Debug panel ────────────────────────────────────────────────────────────

export const renderDebugPanel = (sources, items, generatedAt) => {
  elements.debugPanel.hidden = false;
  elements.debugPanel.innerHTML = buildDebugPanelHtml(sources, items, generatedAt);
};

// ── Time grouping ──────────────────────────────────────────────────────────

const GROUP_ORDER = ['Today', 'Yesterday', 'This week'];

const getTimeGroup = (publishedAt) => {
  const itemDate = new Date(publishedAt);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart - 86400000);
  const weekStart = new Date(todayStart - 6 * 86400000);

  if (itemDate >= todayStart) return 'Today';
  if (itemDate >= yesterdayStart) return 'Yesterday';
  if (itemDate >= weekStart) return 'This week';
  return itemDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

const compareGroups = (a, b) => {
  const ai = GROUP_ORDER.indexOf(a);
  const bi = GROUP_ORDER.indexOf(b);
  if (ai !== -1 && bi !== -1) return ai - bi;
  if (ai !== -1) return -1;
  if (bi !== -1) return 1;
  // Both are month labels like "May 2026" — sort newest first
  return new Date('1 ' + b) - new Date('1 ' + a);
};

// ── Card rendering ─────────────────────────────────────────────────────────

const textContent = (html) => {
  const tmp = document.createElement('div');
  tmp.innerHTML = html || '';
  return tmp.textContent;
};

const renderCard = (item) => {
  const catSlug = categorySlug(item.category);
  const subcat = getSubcategory(item);
  const subcatSlug = subcat ? categorySlug(subcat) : '';
  const subcatHtml = subcat
    ? `<button class="meta-tag meta-subcategory meta-subcategory--${subcatSlug}" data-subcategory="${subcatSlug}">${subcat}</button>`
    : '';
  const searchIndex = [item.title, textContent(item.summary), item.category, item.source]
    .map(v => (v || '').toLowerCase())
    .join(' ')
    .replace(/"/g, '');
  const summaryHtml = item.summary ? `<p>${item.summary}</p>` : '';
  return `
    <article class="card"
      data-category="${catSlug}"
      data-subcategory="${subcatSlug}"
      data-search="${searchIndex}"
    >
      <div class="meta">
        <button class="meta-tag meta-category" data-category="${catSlug}">${item.category}</button>
        ${subcatHtml}
        <span>${item.source}</span>
        <span>${formatDate(item.publishedAt)}</span>
      </div>
      <h3><a href="${item.link}" target="_blank" rel="noopener noreferrer">${item.title}</a></h3>
      ${summaryHtml}
    </article>
  `;
};

// ── DOM building ───────────────────────────────────────────────────────────

const renderAllCards = (items) => {
  if (items.length === 0) {
    elements.list.innerHTML = '<p class="empty">No release notes available.</p>';
    return;
  }

  const groups = new Map();
  items.forEach(item => {
    const group = getTimeGroup(item.publishedAt);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(item);
  });

  const orderedGroups = [...groups.keys()].sort(compareGroups);

  elements.list.innerHTML = orderedGroups
    .map(group => `
      <div class="time-group" data-group="${group}">
        <h2 class="time-group-header">${group}</h2>
        <div class="time-group-grid">
          ${groups.get(group).map(renderCard).join('')}
        </div>
      </div>
    `)
    .join('');

  attachCardListeners();
};

const attachCardListeners = () => {
  elements.list.querySelectorAll('.meta-category').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.activeCategory = btn.dataset.category;
      state.activeSubcategory = '';
      elements.topicBtns.forEach((b) => b.classList.toggle('active', b.dataset.category === state.activeCategory));
      applyFilter();
    });
  });

  elements.list.querySelectorAll('.meta-subcategory').forEach((btn) => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.card');
      state.activeCategory = card.dataset.category;
      state.activeSubcategory = btn.dataset.subcategory === state.activeSubcategory ? '' : btn.dataset.subcategory;
      elements.topicBtns.forEach((b) => b.classList.toggle('active', b.dataset.category === state.activeCategory));
      applyFilter();
    });
  });
};

// ── Subcategory filters ────────────────────────────────────────────────────

const renderSubcategoryFilters = () => {
  const subEl = elements.subcategoryFilters;

  if (!state.activeCategory) {
    subEl.hidden = true;
    return;
  }

  const subcats = new Map();
  elements.list.querySelectorAll(`.card[data-category="${state.activeCategory}"]`).forEach(card => {
    const slug = card.dataset.subcategory;
    if (slug) {
      const labelEl = card.querySelector('.meta-subcategory');
      subcats.set(slug, labelEl ? labelEl.textContent : slug);
    }
  });

  if (subcats.size === 0) {
    subEl.hidden = true;
    return;
  }

  subEl.hidden = false;
  subEl.innerHTML = [...subcats.entries()]
    .map(([slug, label]) => {
      const isActive = state.activeSubcategory === slug;
      return `<button class="subcategory-btn${isActive ? ' active' : ''}" data-subcategory="${slug}">${label}</button>`;
    })
    .join('');

  subEl.querySelectorAll('.subcategory-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.activeSubcategory = btn.dataset.subcategory === state.activeSubcategory ? '' : btn.dataset.subcategory;
      applyFilter();
    });
  });
};

// ── Category counts ────────────────────────────────────────────────────────

const updateCategoryCounts = () => {
  const query = elements.search.value.trim().toLowerCase();
  const counts = new Map();
  let total = 0;

  // Count by category matching search only (not category/subcategory filter)
  elements.list.querySelectorAll('.card').forEach(card => {
    if (query && !card.dataset.search.includes(query)) return;
    const cat = card.dataset.category;
    counts.set(cat, (counts.get(cat) || 0) + 1);
    total++;
  });

  elements.topicBtns.forEach(btn => {
    const cat = btn.dataset.category;
    const count = cat ? (counts.get(cat) || 0) : total;
    const baseLabel = btn.dataset.baseLabel || btn.textContent.replace(/\s*\(\d+\)\s*$/, '').trim();
    if (!btn.dataset.baseLabel) btn.dataset.baseLabel = baseLabel;
    btn.textContent = `${baseLabel} (${count})`;
  });
};

// ── Stats ──────────────────────────────────────────────────────────────────

const updateStats = () => {
  const visibleCount = elements.list.querySelectorAll('.card:not(.filtered-out)').length;
  elements.stats.textContent = `Showing ${visibleCount} of ${state.items.length} entries`;
};

// ── FLIP animation ─────────────────────────────────────────────────────────

const recordRects = (cards) => {
  const map = new Map();
  cards.forEach(card => map.set(card, card.getBoundingClientRect()));
  return map;
};

const applyFLIP = (beforeRects, cards) => {
  cards.forEach(card => {
    const before = beforeRects.get(card);
    if (!before) return;
    const after = card.getBoundingClientRect();
    const dx = before.left - after.left;
    const dy = before.top - after.top;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;

    card.style.transition = 'none';
    card.style.transform = `translate(${dx}px, ${dy}px)`;

    requestAnimationFrame(() => {
      card.style.transition = `transform ${FLIP_DURATION_MS}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
      card.style.transform = '';
      setTimeout(() => {
        card.style.transition = '';
        card.style.transform = '';
      }, FLIP_DURATION_MS + 50);
    });
  });
};

// ── Section visibility ─────────────────────────────────────────────────────

const updateSectionVisibility = () => {
  elements.list.querySelectorAll('.time-group').forEach(group => {
    group.hidden = !group.querySelector('.card:not(.filtered-out)');
  });
};

// ── Card filter predicate ──────────────────────────────────────────────────

const cardMatchesState = (card) => {
  const query = elements.search.value.trim().toLowerCase();
  if (query && !card.dataset.search.includes(query)) return false;
  if (state.activeCategory && card.dataset.category !== state.activeCategory) return false;
  if (state.activeSubcategory && card.dataset.subcategory !== state.activeSubcategory) return false;
  return true;
};

// ── Filter application with FLIP ───────────────────────────────────────────

let filterTimer = null;

const applyFilter = () => {
  // Cancel any pending animation and reset in-progress styles
  if (filterTimer !== null) {
    clearTimeout(filterTimer);
    filterTimer = null;
    elements.list.querySelectorAll('.card').forEach(card => {
      card.style.transition = '';
      card.style.opacity = '';
      card.style.transform = '';
    });
  }

  const allCards = Array.from(elements.list.querySelectorAll('.card'));
  const willRemain = [];
  const willDisappear = [];
  const willAppear = [];

  allCards.forEach(card => {
    const wasVisible = !card.classList.contains('filtered-out');
    const willBeVisible = cardMatchesState(card);
    if (wasVisible && willBeVisible) willRemain.push(card);
    else if (wasVisible && !willBeVisible) willDisappear.push(card);
    else if (!wasVisible && willBeVisible) willAppear.push(card);
  });

  renderSubcategoryFilters();

  // Record first positions of all cards that will remain visible
  const firstRects = recordRects(willRemain);

  const doUpdate = () => {
    // Hide departed cards
    willDisappear.forEach(card => {
      card.classList.add('filtered-out');
      card.style.transition = '';
      card.style.opacity = '';
      card.style.transform = '';
    });

    // Show appearing cards (invisible initially)
    willAppear.forEach(card => {
      card.classList.remove('filtered-out');
      card.style.opacity = '0';
      card.style.transform = 'scale(0.85)';
    });

    updateSectionVisibility();

    // FLIP remaining cards to their new positions
    requestAnimationFrame(() => {
      applyFLIP(firstRects, willRemain);

      // Fade in newly appearing cards
      willAppear.forEach((card, i) => {
        setTimeout(() => {
          card.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
          card.style.opacity = '';
          card.style.transform = '';
          setTimeout(() => { card.style.transition = ''; }, 300);
        }, Math.min(i * 25, 120));
      });

      updateCategoryCounts();
      updateStats();
    });
  };

  if (willDisappear.length > 0) {
    // Animate departing cards out first
    willDisappear.forEach(card => {
      card.style.transition = `opacity ${FADE_OUT_MS}ms ease, transform ${FADE_OUT_MS}ms ease`;
      card.style.opacity = '0';
      card.style.transform = 'scale(0.85)';
    });
    filterTimer = setTimeout(() => {
      filterTimer = null;
      doUpdate();
    }, FADE_OUT_MS);
  } else {
    doUpdate();
  }
};

// ── Full render (on load / "Older" click) ──────────────────────────────────

const render = () => {
  // Cancel any in-progress filter animation
  if (filterTimer !== null) {
    clearTimeout(filterTimer);
    filterTimer = null;
  }

  const windowCutoff = new Date(Date.now() - state.visibleWindows * WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const windowedItems = filterByDateWindow(state.items, windowCutoff);
  const showOlder = hasOlderItems(state.items, windowCutoff, ARCHIVE_START);

  elements.olderContainer.hidden = !showOlder;

  renderAllCards(windowedItems);

  // Re-apply active filters without animation
  if (state.activeCategory || state.activeSubcategory || elements.search.value.trim()) {
    elements.list.querySelectorAll('.card').forEach(card => {
      if (!cardMatchesState(card)) card.classList.add('filtered-out');
    });
    updateSectionVisibility();
  }

  updateCategoryCounts();
  updateStats();
};

// ── Suggestions ────────────────────────────────────────────────────────────

const renderSuggestions = () => {
  elements.suggestions.innerHTML = state.suggestions.map((value) => `<option value="${value}"></option>`).join('');
};

// ── Data loading ───────────────────────────────────────────────────────────

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

// ── Event listeners ────────────────────────────────────────────────────────

elements.topicBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    state.activeCategory = btn.dataset.category;
    state.activeSubcategory = '';
    elements.topicBtns.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    applyFilter();
  });
});

let searchTimer = null;
elements.search.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(applyFilter, 120);
});

elements.olderBtn.addEventListener('click', () => {
  state.visibleWindows += 1;
  render();
});

init().catch((error) => {
  console.error(error);
  elements.list.innerHTML = `<p class="empty">Unable to load release news right now.</p>`;
});
