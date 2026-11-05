import { useSearchParams } from "react-router";

// A page's tab, kept in the query string (`?view=unmatched`), so a tab can
// be linked to and Back from a detail page returns to it rather than the
// first one. The value is user-editable input: anything not in `values`
// shows `fallback`. Changing tabs replaces the history entry, like a list's
// filters, and leaves the other query values alone.
export default function useUrlTab<T extends string>(
  values: readonly T[],
  fallback: T,
  param = "view"
): [T, (next: T) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get(param);
  const value = values.find((candidate) => candidate === raw) ?? fallback;

  const setValue = (next: T) =>
    setSearchParams(
      (current) => {
        const params = new URLSearchParams(current);
        if (next === fallback) params.delete(param);
        else params.set(param, next);
        return params;
      },
      { replace: true }
    );

  return [value, setValue];
}
