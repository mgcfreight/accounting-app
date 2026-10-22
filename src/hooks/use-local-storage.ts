import { useSyncExternalStore } from "react";

// mokal-app's useLocalStorage, for per-viewer UI state such as which sidebar
// group is open. Storage can be unavailable (private mode, blocked site data),
// so every access is guarded and the value falls back to the default.
//
// Built on useSyncExternalStore: the static HTML and the first client render
// both use `initialValue` (getServerSnapshot), then React switches to the
// stored value — no hydration mismatch and no setState inside an effect.

const CHANGE_EVENT = "local-storage-change";

const read = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const subscribe = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
};

export default function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T) => void] {
  // The raw string is the snapshot, so an unchanged value compares equal.
  const raw = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null
  );

  // Storage is user-editable, so a value of the wrong type is ignored.
  let value = initialValue;
  if (raw !== null) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === typeof initialValue) value = parsed as T;
    } catch {
      // Keep the default.
    }
  }

  const update = (next: T) => {
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Not persisted.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };

  return [value, update];
}
