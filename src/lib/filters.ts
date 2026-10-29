import { useSearchParams } from 'react-router-dom';

/** Keep filters in the URL so they survive refresh and can be shared. */
export function useUrlFilters({ omitAll = false } = {}) {
  const [params, setParams] = useSearchParams();
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value && (!omitAll || value !== 'all')) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };
  return { params, setParams, set };
}
