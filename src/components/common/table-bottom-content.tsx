import { Pagination, Select, SelectItem } from "@heroui/react";
import { Dispatch, SetStateAction } from "react";
import { PAGE_SIZES } from "@/lib/constants";
import { PaginationMeta } from "@/lib/types";

// mokal-app's TableBottomContent: "Showing x-y of n", page size, pager.
export default function TableBottomContent({
  meta,
  setMeta,
  bottomContent,
}: {
  meta: PaginationMeta;
  setMeta: Dispatch<SetStateAction<PaginationMeta>>;
  bottomContent?: string;
}) {
  const { currentPage: page, itemsPerPage: limit, totalItems: total } = meta;
  const firstShown = total === 0 ? 0 : page * limit - limit + 1;
  const lastShown = Math.min(page * limit, total);

  return (
    <div className="flex w-full flex-wrap justify-between items-center gap-3 p-5">
      <p className="text-[#6C757D] text-sm">
        Showing {firstShown}-{lastShown} of {total} {bottomContent}
      </p>
      <div className="flex gap-2">
        <Select
          className="w-20"
          aria-label="Rows per page"
          selectedKeys={[`${limit}`]}
          disallowEmptySelection
          onChange={(e) => {
            const itemsPerPage = Number(e.target.value);
            if (!Number.isInteger(itemsPerPage) || itemsPerPage < 1) return;
            // Page N of the old size is a different set of rows at the new
            // size, so start again from page 1.
            setMeta((prev) =>
              prev.itemsPerPage === itemsPerPage
                ? prev
                : { ...prev, itemsPerPage, currentPage: 1 }
            );
          }}
        >
          {PAGE_SIZES.map((size) => (
            <SelectItem key={`${size}`}>{`${size}`}</SelectItem>
          ))}
        </Select>
        <Pagination
          isCompact
          showControls
          showShadow
          className="text-white"
          color="primary"
          page={page}
          total={Math.max(meta.totalPages, 1)}
          onChange={(next) =>
            setMeta((prev) =>
              prev.currentPage === next ? prev : { ...prev, currentPage: next }
            )
          }
        />
      </div>
    </div>
  );
}
