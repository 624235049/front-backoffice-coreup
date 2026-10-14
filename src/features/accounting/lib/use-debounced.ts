import { useEffect, useState } from 'react';

/** Value that follows `value` after `ms` of quiet — used for type-to-search so each keystroke does not hit the API. */
export function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}
