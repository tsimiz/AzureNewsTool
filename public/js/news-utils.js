export const normalize = (value = '') => value.toLowerCase().trim();

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
