import { Dispatch, SetStateAction, useState } from "react";
import { PAGE_SIZES } from "@/lib/constants";
import { PaginationMeta, TableSort } from "@/lib/types";

// Page, page size and sort for a list the API pages and sorts, for
// BaseTable — the server-side counterpart of useClientTable. Pass the
// filters serialised as `filterKey`: when they change, the list goes back to
// page 1. Ask for `page` / `limit` / `sort`, then hand the response's meta to
// `pager` for the table's pager.
export default function useServerTable(
  filterKey: string,
  initialSort: TableSort | null = null
) {
  const [state, setState] = useState({
    filterKey,
    page: 1,
    limit: PAGE_SIZES[0],
    sort: initialSort,
  });
  const page = state.filterKey === filterKey ? state.page : 1;

  const pager = (meta: PaginationMeta | undefined) => {
    // Until the first page arrives, what is being asked for.
    const current: PaginationMeta = meta ?? {
      currentPage: page,
      itemsPerPage: state.limit,
      itemCount: 0,
      totalItems: 0,
      totalPages: 0,
    };
    const setMeta: Dispatch<SetStateAction<PaginationMeta>> = (update) => {
      const next = typeof update === "function" ? update(current) : update;
      setState((prev) => ({
        ...prev,
        filterKey,
        page: next.currentPage,
        limit: next.itemsPerPage,
      }));
    };
    return { meta: current, setMeta };
  };

  const onSortChange = (sort: TableSort | null) =>
    setState((prev) => ({ ...prev, filterKey, page: 1, sort }));

  return { page, limit: state.limit, sort: state.sort, onSortChange, pager };
}
