import { Card } from "@heroui/react";
import { useNavigate } from "react-router";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import {
  BaseInput,
  BaseSelect,
  BaseTable,
  FilterBar,
  RowActions,
} from "@/components/common";
import { EyeIcon, SearchNormalSm } from "@/components/icons";
import { useCan } from "@/components/providers/user-provider";
import { useClientTable } from "@/hooks";
import { InvoiceDirection, InvoiceStatus } from "@/lib/enums";
import { Invoice } from "@/lib/interfaces";
import { mockCarrierInvoices, mockShipperInvoices } from "@/lib/mock";
import { BaseTableColumn } from "@/lib/types";
import { humanize } from "@/lib/utils";
import InvoiceActionModal, { InvoiceAction } from "./invoice-action-modal";
import InvoiceCell, { invoiceHref } from "./invoice-cell";
import { availableActions } from "./invoice-row-actions";

type Filters = { search: string; status: string; flag: string };

const statusOptions = [
  { key: "ALL", label: "All statuses", value: "ALL" },
  ...Object.values(InvoiceStatus).map((status) => ({
    key: status,
    label: humanize(status),
    value: status,
  })),
];

const flagOptions = [
  { key: "ALL", label: "All invoices", value: "ALL" },
  { key: "OVERDUE", label: "Overdue", value: "OVERDUE" },
  { key: "DISPUTED", label: "Disputed", value: "DISPUTED" },
];

const columnsFor = (direction: InvoiceDirection): BaseTableColumn[] => [
  { key: "number", label: "Invoice #", sortable: true },
  {
    key: "party",
    label:
      direction === InvoiceDirection.Receivable ? "Shipper" : "Carrier",
    sortable: true,
    sortKey: "partyName",
  },
  { key: "lane", label: "Lane" },
  ...(direction === InvoiceDirection.Payable
    ? [{ key: "carrierBillNo", label: "Carrier Bill #" }]
    : []),
  { key: "invoiceDate", label: "Invoice Date", sortable: true, sortType: "date" as const },
  { key: "dueDate", label: "Due Date", sortable: true, sortType: "date" as const },
  { key: "total", label: "Total", sortable: true, sortType: "money" as const },
  { key: "balance", label: "Balance", sortable: true, sortType: "money" as const },
  { key: "status", label: "Status" },
  { key: "actions", label: "" },
];

const filterTrigger = { trigger: "bg-white border-none h-12 rounded-lg" };

// The shipper (AR) and carrier (AP) invoice lists share one container, as
// they share one design (§9: "Carrier invoices: same as above").
export default function InvoiceList({
  direction,
}: {
  direction: InvoiceDirection;
}) {
  const navigate = useNavigate();
  const { can } = useCan();
  const [active, setActive] = useState<{
    action: InvoiceAction;
    invoice: Invoice;
  } | null>(null);
  const { control } = useForm<Filters>({
    defaultValues: { search: "", status: "ALL", flag: "ALL" },
  });
  const search = useWatch({ control, name: "search" }).trim().toLowerCase();
  const status = useWatch({ control, name: "status" });
  const flag = useWatch({ control, name: "flag" });

  const source =
    direction === InvoiceDirection.Receivable
      ? mockShipperInvoices
      : mockCarrierInvoices;
  const columns = useMemo(() => columnsFor(direction), [direction]);

  const filtered = useMemo(
    () =>
      source.filter((invoice) => {
        if (status && status !== "ALL" && invoice.status !== status) {
          return false;
        }
        if (flag === "OVERDUE" && invoice.overdueDays === 0) return false;
        if (flag === "DISPUTED" && !invoice.disputed) return false;
        if (!search) return true;
        return [
          invoice.number,
          invoice.partyName,
          invoice.shipmentId,
          invoice.carrierBillNo ?? "",
        ].some((value) => value.toLowerCase().includes(search));
      }),
    [source, search, status, flag]
  );

  const table = useClientTable(filtered, columns, {
    column: "invoiceDate",
    sortKey: "invoiceDate",
    direction: "desc",
  });

  const renderCell = (invoice: Invoice, key: string) => {
    if (key !== "actions") {
      return <InvoiceCell invoice={invoice} columnKey={key} />;
    }
    return (
      <RowActions
        actions={[
          {
            key: "view",
            label: "View details",
            icon: <EyeIcon />,
            onPress: () => navigate(invoiceHref(invoice)),
          },
          ...availableActions(invoice, can).map((action) => ({
            ...action,
            onPress: () => setActive({ action: action.key, invoice }),
          })),
        ]}
      />
    );
  };

  return (
    <>
      <FilterBar>
        <BaseInput
          name="search"
          control={control}
          className="max-w-sm"
          classNames={{
            inputWrapper: "bg-[#FFFFFF66] h-12 border-1 rounded-lg",
          }}
          placeholder={
            direction === InvoiceDirection.Receivable
              ? "Search by invoice #, shipper or shipment"
              : "Search by invoice #, carrier, bill # or shipment"
          }
          endContent={<SearchNormalSm />}
        />
        <BaseSelect
          name="status"
          control={control}
          options={statusOptions}
          className="w-full sm:w-48"
          classNames={filterTrigger}
          aria-label="Status"
          disallowEmptySelection
        />
        <BaseSelect
          name="flag"
          control={control}
          options={flagOptions}
          className="w-full sm:w-44"
          classNames={filterTrigger}
          aria-label="Flag"
          disallowEmptySelection
        />
      </FilterBar>
      <Card className="mt-4">
        <BaseTable
          ariaLabel={
            direction === InvoiceDirection.Receivable
              ? "Shipper invoices"
              : "Carrier invoices"
          }
          columns={columns}
          data={table.pageRows}
          rowKey={(row) => row.id}
          renderCell={renderCell}
          meta={table.meta}
          setMeta={table.setMeta}
          sort={table.sort}
          onSortChange={table.onSortChange}
          bottomContent="Invoices"
        />
      </Card>
      {active && (
        <InvoiceActionModal
          action={active.action}
          invoice={active.invoice}
          onClose={() => setActive(null)}
        />
      )}
    </>
  );
}
