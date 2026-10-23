import { useEffect, useState } from "react";

// `value`, once it has stopped changing for `delay` ms: a search box asks the
// API once per pause in typing, not once per key.
export default function useDebouncedValue<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
