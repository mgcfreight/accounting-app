import type { ReactNode } from "react";

// Table types, carried over from mokal-app's lib/types/input-props.d.ts.

export type SortDirection = "asc" | "desc";

export type TableSort = {
  // The column's `key`, which the header arrow is drawn against.
  column: string;
  // The column's `sortKey`, falling back to `key`: what to sort on.
  sortKey: string;
  direction: SortDirection;
};

export type PaginationMeta = {
  currentPage: number;
  itemCount: number;
  itemsPerPage: number;
  totalItems: number;
  totalPages: number;
};

export type BaseTableColumn = {
  key: string;
  label: string;
  sortable?: boolean;
  // A (dotted) field path on the row to sort on, when it isn't `key`.
  sortKey?: string;
  // How values compare. Defaults to "string". Money strings sort as "money".
  sortType?: "string" | "number" | "date" | "money";
  // The value to sort a row by, when no single field holds it.
  sortValue?: (row: never) => unknown;
  // Amounts and counts go "end", so their digits line up down the column.
  align?: "start" | "center" | "end";
};

export type SelectOption = {
  key: string;
  label: string;
  value: string | number;
};

export type DashboardCardItem = {
  icon: ReactNode;
  iconBgClass: string;
  name: string;
  value: string;
  caption?: string;
  pageLink?: string;
};
