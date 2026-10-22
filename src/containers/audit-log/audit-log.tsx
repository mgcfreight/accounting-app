import { Card } from "@heroui/react";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import {
  BaseInput,
  BaseSelect,
  BaseTable,
  FilterBar,
  FormModal,
  PartyAvatar,
  RowActions,
  StatusChip,
} from "@/components/common";
import { EyeIcon, SearchNormalSm } from "@/components/icons";
import { useClientTable } from "@/hooks";
import { AuditEntry } from "@/lib/interfaces";
import { mockAuditLog } from "@/lib/mock";
import { BaseTableColumn } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

type Filters = { search: string; entity: string; user: string };

const columns: BaseTableColumn[] = [
  { key: "at", label: "Time", sortable: true, sortType: "date" },
  { key: "user", label: "User", sortable: true },
  { key: "entity", label: "Record" },
  { key: "action", label: "Action" },
  { key: "summary", label: "Change" },
  { key: "actions", label: "" },
];

const all = (label: string) => ({ key: "ALL", label, value: "ALL" });
const unique = (values: string[]) =>
  Array.from(new Set(values)).map((value) => ({ key: value, label: value, value }));

const summarize = (entry: AuditEntry) =>
  Object.entries(entry.after ?? {})
    .map(([field, value]) => {
      const before = entry.before?.[field];
      return before === undefined
        ? `${field}: ${String(value)}`
        : `${field}: ${String(before)} → ${String(value)}`;
    })
    .join(", ");

// Design §11: the append-only change history, read-only and searchable.
export default function AuditLog() {
  const [open, setOpen] = useState<AuditEntry | null>(null);
  const { control } = useForm<Filters>({
    defaultValues: { search: "", entity: "ALL", user: "ALL" },
  });
  const search = useWatch({ control, name: "search" }).trim().toLowerCase();
  const entity = useWatch({ control, name: "entity" });
  const user = useWatch({ control, name: "user" });

  const filtered = useMemo(
    () =>
      mockAuditLog.filter((entry) => {
        if (entity && entity !== "ALL" && entry.entity !== entity) return false;
        if (user && user !== "ALL" && entry.user !== user) return false;
        if (!search) return true;
        return [entry.entityId, entry.action, summarize(entry)].some((value) =>
          value.toLowerCase().includes(search)
        );
      }),
    [search, entity, user]
  );

  const table = useClientTable(filtered, columns, {
    column: "at",
    sortKey: "at",
    direction: "desc",
  });

  const renderCell = (entry: AuditEntry, key: string) => {
    switch (key) {
      case "at":
        return <span className="whitespace-nowrap">{formatDateTime(entry.at)}</span>;
      case "user":
        return <PartyAvatar name={entry.user} />;
      case "entity":
        return (
          <div>
            <p className="font-semibold">{entry.entity}</p>
            <p className="font-mono text-gray-500">{entry.entityId}</p>
          </div>
        );
      case "action":
        return <StatusChip text={entry.action} tone="neutral" />;
      case "summary":
        return <span className="line-clamp-2 max-w-md">{summarize(entry)}</span>;
      case "actions":
        return (
          <RowActions
            actions={[
              { key: "view", label: "View before / after", icon: <EyeIcon />, onPress: () => setOpen(entry) },
            ]}
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
      <FilterBar>
        <BaseInput
          name="search"
          control={control}
          className="max-w-sm"
          classNames={{ inputWrapper: "bg-[#FFFFFF66] h-12 border-1 rounded-lg" }}
          placeholder="Search by record id or change"
          endContent={<SearchNormalSm />}
        />
        <BaseSelect
          name="entity"
          control={control}
          options={[all("All records"), ...unique(mockAuditLog.map((e) => e.entity))]}
          className="w-full sm:w-44"
          classNames={{ trigger: "bg-white border-none h-12 rounded-lg" }}
          aria-label="Record type"
          disallowEmptySelection
        />
        <BaseSelect
          name="user"
          control={control}
          options={[all("All users"), ...unique(mockAuditLog.map((e) => e.user))]}
          className="w-full sm:w-44"
          classNames={{ trigger: "bg-white border-none h-12 rounded-lg" }}
          aria-label="User"
          disallowEmptySelection
        />
      </FilterBar>
      <Card className="mt-4">
        <BaseTable
          ariaLabel="Audit log"
          columns={columns}
          data={table.pageRows}
          rowKey={(row) => row.id}
          renderCell={renderCell}
          meta={table.meta}
          setMeta={table.setMeta}
          sort={table.sort}
          onSortChange={table.onSortChange}
          bottomContent="Entries"
        />
      </Card>
      {open && (
        <FormModal
          isOpen
          onOpenChange={(isOpen) => !isOpen && setOpen(null)}
          title={`${open.entity} ${open.entityId}`}
          confirmText="Close"
          onConfirm={() => setOpen(null)}
          size="2xl"
        >
          <p className="text-sm text-[#707070]">
            {open.action} by {open.user} · {formatDateTime(open.at)}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(["before", "after"] as const).map((side) => (
              <div key={side}>
                <p className="text-xs font-semibold uppercase text-base-primary mb-1">{side}</p>
                {/* Rendered as text by React, so field values cannot inject markup. */}
                <pre className="bg-content-2 rounded-lg p-3 text-xs overflow-auto">
                  {open[side] ? JSON.stringify(open[side], null, 2) : "—"}
                </pre>
              </div>
            ))}
          </div>
        </FormModal>
      )}
    </>
  );
}
