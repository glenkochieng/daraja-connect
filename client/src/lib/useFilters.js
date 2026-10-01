import { useSearchParams } from 'react-router';

/**
 * Filters kept in the URL, so a search can be shared, bookmarked and reached again with
 * the back button. Changing any filter returns to page 1.
 */
export function useFilters(defaults) {
  const [params, setParams] = useSearchParams();
  const values = Object.fromEntries(
    Object.entries(defaults).map(([key, fallback]) => [key, params.get(key) ?? fallback]),
  );
  const page = Math.max(1, Number(params.get('page')) || 1);

  const write = (next, nextPage) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(next)) {
      if (value !== '' && value !== defaults[key]) search.set(key, value);
    }
    if (nextPage > 1) search.set('page', String(nextPage));
    setParams(search, { preventScrollReset: true });
  };

  return {
    values,
    page,
    setFilters: (patch) => write({ ...values, ...patch }, 1),
    setPage: (nextPage) => write(values, nextPage),
    clear: () => write(defaults, 1),
    isFiltered: Object.entries(values).some(([key, value]) => value !== defaults[key]),
  };
}
