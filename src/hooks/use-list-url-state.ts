import { useEffect, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router";
import { z } from "zod";
import { PAGE_SIZES } from "@/lib/constants";

// A list's filters, sort and page, kept in the query string
// (`?status=PAID&page=3`), so Back from a detail page, a refresh or a
// bookmark shows the list as it was rather than starting again.
//
// The query string is user-editable input. `useListUrlState` reads it once,
// on mount, through a schema whose every field has a `.catch`: a value that
// isn't one the list offers shows the default instead of an error.
// `useSyncListUrl` writes the list's current values back, replacing the
// history entry rather than adding one per keystroke, and leaves out values
// equal to their default so an unfiltered list keeps a clean URL.

type Values = Record<string, string>;

// One of `values`, or `fallback`.
export const oneOf = (values: readonly string[], fallback: string) =>
  z
    .string()
    .refine((value) => values.includes(value))
    .catch(fallback);

// Free text, cut to what the list's request sends.
export const searchParam = (maxLength: number) =>
  z
    .string()
    .catch("")
    .transform((value) => value.slice(0, maxLength));

export const pageParam = z
  .string()
  .regex(/^[1-9]\d{0,5}$/)
  .catch("1");

export const limitParam = (fallback = PAGE_SIZES[0]) =>
  oneOf(PAGE_SIZES.map(String), String(fallback));

export function useListUrlState<S extends z.ZodType<Values>>(
  schema: S
): z.output<S> {
  const [searchParams] = useSearchParams();
  const [initial] = useState(() =>
    schema.parse(Object.fromEntries(searchParams))
  );
  return initial;
}

// Each list's last query string, by path, so a detail page's breadcrumb can
// go back to the list as it was left (listReturnHref). In memory only.
const lastListQuery = new Map<string, string>();

// `listPath` with the filters, sort and page it was last shown with in this
// tab, or plain `listPath` if it hasn't been opened.
export const listReturnHref = (listPath: string) => {
  const query = lastListQuery.get(listPath);
  return query ? `${listPath}?${query}` : listPath;
};

export function useSyncListUrl(current: Values, defaults: Values) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { pathname } = useLocation();
  // Written only while this list's page is the one showing.
  const listPath = useRef(pathname);

  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(current)) {
    if (value && value !== defaults[key]) next.set(key, value);
  }
  const query = next.toString();
  const shown = searchParams.toString();

  useEffect(() => {
    if (pathname !== listPath.current) return;
    lastListQuery.set(listPath.current, query);
    if (query === shown) return;
    setSearchParams(new URLSearchParams(query), { replace: true });
  }, [pathname, query, shown, setSearchParams]);
}
