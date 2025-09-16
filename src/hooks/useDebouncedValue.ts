import { useEffect, useState } from 'react';

/**
 * Generic debounce hook for primitive values.
 * Returns a debounced version of the input value that only updates
 * after the specified delay has elapsed without changes.
 */
export function useDebouncedValue<T>(value: T, delay: number = 300): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
