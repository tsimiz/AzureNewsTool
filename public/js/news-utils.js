export const normalize = (value = '') => value.toLowerCase().trim();

export const categorySlug = (category = '') =>
  category.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

export const filterItems = (items, keyword) => {
  const normalizedKeyword = normalize(keyword);
  if (!normalizedKeyword) {
    return items;
  }

  return items.filter((item) => {
    const haystack = [item.title, item.summary, item.category, item.source].map(normalize).join(' ');
    return haystack.includes(normalizedKeyword);
  });
};

export const formatDate = (dateValue) => {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown date';
  }
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(date);
};

export const buildDebugPanelHtml = (sources, items, generatedAt) => {
  const itemsBySource = {};
  for (const item of items) {
    itemsBySource[item.source] = (itemsBySource[item.source] || 0) + 1;
  }

  const rows = sources
    .map((source) => {
      const count = itemsBySource[source.name] || 0;
      const ok = count > 0;
      return `
        <tr>
          <td><span class="debug-status ${ok ? 'debug-ok' : 'debug-warn'}">${ok ? '✅' : '⚠️'}</span></td>
          <td>${source.name}</td>
          <td>${source.category}</td>
          <td>${count} item${count !== 1 ? 's' : ''}</td>
          <td><a href="${source.url}" target="_blank" rel="noopener noreferrer">${source.url}</a></td>
        </tr>`;
    })
    .join('');

  return `
    <div class="debug-header">
      <span class="debug-badge">🛠 Debug</span>
      <span>Source availability — last fetched: ${formatDate(generatedAt)}</span>
    </div>
    <table class="debug-table">
      <thead>
        <tr>
          <th>Status</th>
          <th>Source</th>
          <th>Category</th>
          <th>Items</th>
          <th>Feed URL</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
};
