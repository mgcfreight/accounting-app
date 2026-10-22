import { Dispatch, SetStateAction, useMemo, useState } from "react";
import { sortTableRows } from "@/lib/table-sort";
import { BaseTableColumn, PaginationMeta, TableSort } from "@/lib/types";

// Sorts and pages a list in the browser, for BaseTable. It stands in for the
// server while the screens run on mock data; when a list comes from the API,
// pass `sort` and `meta` to the request instead and drop this hook.
export default function useClientTable<T>(
  rows: T[],
  columns: BaseTableColumn[],
  initialSort: TableSort | null = null
) {
  const [sort, setSort] = useState<TableSort | null>(initialSort);
  const [paging, setPaging] = useState({ currentPage: 1, itemsPerPage: 10 });

  const sorted = useMemo(() => {
    const column = sort && columns.find((c) => c.key === sort.column);
    return column && sort ? sortTableRows(rows, column, sort.direction) : rows;
  }, [rows, columns, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / paging.itemsPerPage));
  // A narrower filter can leave the current page past the end; show the last
  // page that exists rather than an empty one.
  const currentPage = Math.min(paging.currentPage, totalPages);
  const start = (currentPage - 1) * paging.itemsPerPage;
  const pageRows = sorted.slice(start, start + paging.itemsPerPage);

  const meta: PaginationMeta = {
    currentPage,
    itemsPerPage: paging.itemsPerPage,
    itemCount: pageRows.length,
    totalItems: sorted.length,
    totalPages,
  };

  const setMeta: Dispatch<SetStateAction<PaginationMeta>> = (update) => {
    const next = typeof update === "function" ? update(meta) : update;
    setPaging({
      currentPage: next.currentPage,
      itemsPerPage: next.itemsPerPage,
    });
  };

  const onSortChange = (next: TableSort | null) => {
    setSort(next);
    setPaging((prev) => ({ ...prev, currentPage: 1 }));
  };

  return { pageRows, meta, setMeta, sort, onSortChange };
}
