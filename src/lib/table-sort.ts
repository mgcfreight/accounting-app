import type { SortDescriptor } from "@heroui/react";
import { compareMoney } from "./money";
import type { BaseTableColumn, SortDirection, TableSort } from "./types";

// Ported from mokal-app's lib/table-sort.ts (client-side mode only — there is
// no server to sort for yet).

// "No sort", as a descriptor naming no column. Passing undefined instead would
// hand the arrow to HeroUI's own state, which keeps showing a cleared sort.
const NO_SORT: SortDescriptor = { column: "", direction: "ascending" };

export const toSortDescriptor = (sort: TableSort | null): SortDescriptor =>
  sort
    ? {
        column: sort.column,
        direction: sort.direction === "asc" ? "ascending" : "descending",
      }
    : NO_SORT;

// The sort after a header click: asc -> desc -> off. Undefined when the click
// wasn't on a known column.
export const nextTableSort = (
  current: TableSort | null,
  columns: ReadonlyArray<BaseTableColumn>,
  descriptor: SortDescriptor
): TableSort | null | undefined => {
  const column = columns.find(
    (candidate) => candidate.key === descriptor.column
  );
  if (!column) return undefined;

  if (current?.column === column.key && current.direction === "desc") {
    return null;
  }
  return {
    column: column.key,
    sortKey: column.sortKey ?? column.key,
    direction: descriptor.direction === "descending" ? "desc" : "asc",
  };
};

const isEmpty = (value: unknown) =>
  value === null || value === undefined || value === "";

// "party.name" reads row.party.name.
const readPath = (row: unknown, path: string): unknown =>
  path
    .split(".")
    .reduce<unknown>(
      (value, key) =>
        value === null || value === undefined
          ? undefined
          : (value as Record<string, unknown>)[key],
      row
    );

const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

const compareValues = (
  a: unknown,
  b: unknown,
  sortType: BaseTableColumn["sortType"]
): number => {
  switch (sortType) {
    case "money":
      return compareMoney(String(a), String(b));
    case "number":
      return Number(a) - Number(b);
    case "date":
      return (
        new Date(a as string).getTime() - new Date(b as string).getTime()
      );
    default:
      return collator.compare(String(a), String(b));
  }
};

// A sorted copy of `rows`. Empty values go last in both directions, and rows
// that compare equal keep their original order.
export const sortTableRows = <T>(
  rows: ReadonlyArray<T>,
  column: BaseTableColumn,
  direction: SortDirection
): T[] => {
  const sortKey = column.sortKey ?? column.key;
  const read = (row: T) =>
    column.sortValue
      ? (column.sortValue as (row: T) => unknown)(row)
      : readPath(row, sortKey);
  const sign = direction === "asc" ? 1 : -1;

  return rows
    .map((row) => ({ row, value: read(row) }))
    .sort((a, b) => {
      if (isEmpty(a.value) || isEmpty(b.value)) {
        if (isEmpty(a.value) && isEmpty(b.value)) return 0;
        return isEmpty(a.value) ? 1 : -1;
      }
      return compareValues(a.value, b.value, column.sortType) * sign;
    })
    .map(({ row }) => row);
};
