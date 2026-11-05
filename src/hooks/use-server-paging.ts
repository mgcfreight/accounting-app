import { Dispatch, SetStateAction, useState } from "react";
import { PaginationMeta } from "@/lib/types";

// Page and page size for a list the API pages (`page` + `limit`), wired to
// BaseTable's pager. Pass `page`/`limit` to the request and the response's
// `meta` to `tableMeta` for "Showing x-y of n".
//
// `filterKey` is anything that identifies the current filters and sort: when
// it changes the list is a different one, so paging starts again at page 1.
// `initialPage` is where it opens, e.g. the page kept in the URL.
export default function useServerPaging(
  filterKey = "",
  initialLimit = 10,
  initialPage = 1
) {
  const [paging, setPaging] = useState({
    currentPage: initialPage,
    itemsPerPage: initialLimit,
  });
  const [lastFilterKey, setLastFilterKey] = useState(filterKey);
  if (filterKey !== lastFilterKey) {
    setLastFilterKey(filterKey);
    setPaging((prev) => ({ ...prev, currentPage: 1 }));
  }

  const setMeta: Dispatch<SetStateAction<PaginationMeta>> = (update) =>
    setPaging((prev) => {
      const current = { ...prev, itemCount: 0, totalItems: 0, totalPages: 0 };
      const next = typeof update === "function" ? update(current) : update;
      return next.currentPage === prev.currentPage &&
        next.itemsPerPage === prev.itemsPerPage
        ? prev
        : { currentPage: next.currentPage, itemsPerPage: next.itemsPerPage };
    });

  // A page past the end (an old link, or the last row on it went) moves to
  // the last page there is, rather than showing an empty table.
  const tableMeta = (meta: PaginationMeta | undefined): PaginationMeta => {
    if (meta && meta.totalPages >= 1 && paging.currentPage > meta.totalPages) {
      setPaging((prev) => ({ ...prev, currentPage: meta.totalPages }));
    }
    return meta ?? { ...paging, itemCount: 0, totalItems: 0, totalPages: 1 };
  };

  return {
    page: paging.currentPage,
    limit: paging.itemsPerPage,
    setMeta,
    tableMeta,
  };
}
