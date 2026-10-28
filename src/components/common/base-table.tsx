import {
  Selection,
  SortDescriptor,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/react";
import { Dispatch, Key, MouseEvent, ReactNode, SetStateAction } from "react";
import { nextTableSort, toSortDescriptor } from "@/lib/table-sort";
import { BaseTableColumn, PaginationMeta, TableSort } from "@/lib/types";
import TableBottomContent from "./table-bottom-content";
import TableSkeleton from "./loader/table-skeleton";

// mokal-app's BaseTable on HeroUI: same classNames, same pager, same skeleton.
// Sorting and paging are controlled by the caller (see useClientTable), so the
// same table works unchanged once rows come from the API.
type BaseTableProps<T> = {
  columns: BaseTableColumn[];
  data: T[];
  rowKey: (row: T) => string;
  renderCell?: (row: T, columnKey: string) => ReactNode;
  loading?: boolean;
  meta?: PaginationMeta;
  setMeta?: Dispatch<SetStateAction<PaginationMeta>>;
  bottomContent?: string;
  sort?: TableSort | null;
  onSortChange?: (sort: TableSort | null) => void;
  selectMode?: "none" | "single" | "multiple";
  onSelectionChange?: (keys: Selection) => void;
  emptyContent?: ReactNode;
  ariaLabel?: string;
  // Opens a row when it is clicked anywhere. A mouse convenience only: the
  // row must still have a link (its number or name) for keyboard users.
  onRowClick?: (row: T) => void;
  // True while the rows shown are the previous page's or filter's, kept on
  // screen until the new ones arrive (keepPreviousData). They are dimmed so
  // they are not read as the answer to the new filter.
  refreshing?: boolean;
};

// A click on something inside the row that does its own thing — a link, a
// button, the "…" menu — or one that ends a text selection is not a row click.
// Clicks inside a portal (a menu or modal opened from the row) bubble through
// React to the row too, so anything outside the row's own DOM is ignored.
const INTERACTIVE =
  "a, button, input, select, textarea, label, [role=button], [role=menuitem], [role=checkbox]";

const isRowClick = (event: MouseEvent<HTMLElement>) => {
  const target = event.target as Element;
  if (!event.currentTarget.contains(target)) return false;
  if (target.closest(INTERACTIVE)) return false;
  return !window.getSelection()?.toString();
};

export default function BaseTable<T>({
  columns,
  data,
  rowKey,
  renderCell,
  loading = false,
  meta,
  setMeta,
  bottomContent = "Items",
  sort = null,
  onSortChange,
  selectMode = "none",
  onSelectionChange,
  emptyContent = "No Data Found",
  ariaLabel = "Table",
  onRowClick,
  refreshing = false,
}: BaseTableProps<T>) {
  if (loading) return <TableSkeleton />;

  const handleSortChange = (descriptor: SortDescriptor) => {
    const next = nextTableSort(sort, columns, descriptor);
    if (next !== undefined) onSortChange?.(next);
  };

  return (
    <Table
      aria-label={ariaLabel}
      aria-busy={refreshing}
      bottomContentPlacement="inside"
      selectionMode={selectMode}
      onSelectionChange={onSelectionChange}
      sortDescriptor={toSortDescriptor(sort)}
      onSortChange={handleSortChange}
      classNames={{
        wrapper: "shadow-none",
        th: [
          "bg-transparent",
          "text-default-500",
          "border-b",
          "border-divider",
          "text-xs",
        ],
        td: ["text-xs"],
        // The cells take the hover colour, not the row: globals.css stripes
        // odd rows with an unlayered rule that a row utility can't override.
        tr: onRowClick
          ? "cursor-pointer hover:*:bg-content-12 transition-colors"
          : "",
        table: `overflow-auto transition-opacity ${
          refreshing ? "opacity-50" : ""
        }`,
      }}
      bottomContent={
        meta && setMeta ? (
          <TableBottomContent
            meta={meta}
            setMeta={setMeta}
            bottomContent={bottomContent}
          />
        ) : undefined
      }
      checkboxesProps={{
        classNames: {
          wrapper: "after:bg-foreground after:bg-layout-focus text-white",
        },
      }}
    >
      <TableHeader columns={columns}>
        {(column) => (
          <TableColumn
            key={column.key}
            align={column.align}
            allowsSorting={!!onSortChange && !!column.sortable}
          >
            {column.label}
          </TableColumn>
        )}
      </TableHeader>
      <TableBody emptyContent={emptyContent} items={data}>
        {(row) => (
          <TableRow
            key={rowKey(row)}
            onClick={
              onRowClick
                ? (event: MouseEvent<HTMLElement>) => {
                    if (isRowClick(event)) onRowClick(row);
                  }
                : undefined
            }
          >
            {(columnKey: Key) => (
              <TableCell>
                {renderCell
                  ? renderCell(row, String(columnKey))
                  : String(
                      (row as Record<string, unknown>)[String(columnKey)] ?? ""
                    )}
              </TableCell>
            )}
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
