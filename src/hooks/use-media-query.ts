import { useCallback, useSyncExternalStore } from "react";

// Whether a CSS media query matches, updated as the window is resized. Built
// on useSyncExternalStore like useLocalStorage: the first render uses
// `false` (getServerSnapshot), then the real value.
export default function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query]
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false
  );
}
