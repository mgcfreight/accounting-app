import { Card } from "@heroui/react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import {
  BaseInput,
  BaseSelect,
  BaseTable,
  ErrorState,
  FilterBar,
  RowActions,
} from "@/components/common";
import { EyeIcon, SearchNormalSm } from "@/components/icons";
import { useCurrentUser } from "@/components/providers/user-provider";
import { useDebouncedValue, useServerTable } from "@/hooks";
import {
  CarrierInvoiceStatus,
  CustomerInvoiceStatus,
  InvoiceDirection,
  InvoiceSortBy,
  PaymentStatus,
  SortOrder,
} from "@/lib/enums";
import { BaseTableColumn } from "@/lib/types";
import { humanize } from "@/lib/utils";
import {
  CarrierInvoiceListQuery,
  CustomerInvoiceListQuery,
  getCarrierInvoices,
  getCustomerInvoices,
  Page,
} from "@/services";
import InvoiceActionModal, { InvoiceAction } from "./invoice-action-modal";
import { availableActions } from "./invoice-row-actions";
import InvoiceViewCell, { apiInvoiceHref, InvoiceView } from "./invoice-view";

type Filters = { search: string; status: string; payment: string };

const ALL = "ALL";

const statusLabels: Record<string, string> = {
  [CarrierInvoiceStatus.Expected]: "Awaiting bill",
  [CarrierInvoiceStatus.OnHold]: "On hold",
};

const statusOptionsFor = (direction: InvoiceDirection) => [
  { key: ALL, label: "All statuses", value: ALL },
  ...Object.values(
    direction === InvoiceDirection.Receivable
      ? CustomerInvoiceStatus
      : CarrierInvoiceStatus
  ).map((status) => ({
    key: status,
    label: statusLabels[status] ?? humanize(status),
    value: status,
  })),
];

const paymentOptions = [
  { key: ALL, label: "Paid or unpaid", value: ALL },
  { key: PaymentStatus.Unpaid, label: "Unpaid", value: PaymentStatus.Unpaid },
  { key: PaymentStatus.Paid, label: "Paid", value: PaymentStatus.Paid },
];

// Sortable columns sort on the server: `sortKey` is the API's sortBy.
const columnsFor = (direction: InvoiceDirection): BaseTableColumn[] => [
  {
    key: "number",
    label: direction === InvoiceDirection.Receivable ? "Invoice #" : "Reference #",
    sortable: true,
    sortKey: InvoiceSortBy.Sequence,
  },
  {
    key: "party",
    label: direction === InvoiceDirection.Receivable ? "Shipper" : "Carrier",
  },
  { key: "reference", label: "Load Ref" },
  ...(direction === InvoiceDirection.Payable
    ? [{ key: "carrierBillNo", label: "Carrier Bill #" }]
    : []),
  { key: "invoiceDate", label: "Invoice Date", sortable: true, sortKey: InvoiceSortBy.InvoiceDate },
  { key: "dueDate", label: "Due Date", sortable: true, sortKey: InvoiceSortBy.DueDate },
  { key: "total", label: "Total", sortable: true, sortKey: InvoiceSortBy.Total },
  { key: "balance", label: "Balance", sortable: true, sortKey: InvoiceSortBy.BalanceDue },
  { key: "status", label: "Status" },
  { key: "actions", label: "" },
];

const filterTrigger = { trigger: "bg-white border-none h-12 rounded-lg" };

// The shipper (AR) and carrier (AP) invoice lists share one container, as
// they share one design (§9: "Carrier invoices: same as above"). Filtered,
// sorted and paged by the API.
export default function InvoiceList({
  direction,
}: {
  direction: InvoiceDirection;
}) {
  const navigate = useNavigate();
  const { role } = useCurrentUser();
  const isReceivable = direction === InvoiceDirection.Receivable;
  const [active, setActive] = useState<{
    action: InvoiceAction;
    invoice: InvoiceView;
  } | null>(null);
  const { control } = useForm<Filters>({
    defaultValues: { search: "", status: ALL, payment: ALL },
  });
  const search = useDebouncedValue(useWatch({ control, name: "search" }).trim());
  const status = useWatch({ control, name: "status" });
  const payment = useWatch({ control, name: "payment" });

  const table = useServerTable(JSON.stringify([direction, search, status, payment]));
  const query = {
    page: table.page,
    limit: table.limit,
    ...(search && { searchQuery: search.slice(0, 64) }),
    ...(status !== ALL && { status }),
    ...(payment !== ALL && { paymentStatus: payment as PaymentStatus }),
    ...(table.sort && {
      sortBy: table.sort.sortKey as InvoiceSortBy,
      order: table.sort.direction === "asc" ? SortOrder.Asc : SortOrder.Desc,
    }),
  };

  const invoices = useQuery({
    queryKey: ["invoices", direction, "list", query],
    queryFn: ({ signal }): Promise<Page<InvoiceView>> =>
      isReceivable
        ? getCustomerInvoices(query as CustomerInvoiceListQuery, signal)
        : getCarrierInvoices(query as CarrierInvoiceListQuery, signal),
    placeholderData: keepPreviousData,
  });
  const { meta, setMeta } = table.pager(invoices.data?.meta);

  const renderCell = (invoice: InvoiceView, key: string) => {
    if (key !== "actions") {
      return <InvoiceViewCell invoice={invoice} columnKey={key} />;
    }
    return (
      <RowActions
        actions={[
          {
            key: "view",
            label: "View details",
            icon: <EyeIcon />,
            onPress: () => navigate(apiInvoiceHref(invoice)),
          },
          ...availableActions(invoice, role).map((action) => ({
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
            isReceivable
              ? "Invoice # (start of it) or exact BOL, PO, PRO…"
              : "Reference #, carrier bill # or exact BOL, PO, PRO…"
          }
          endContent={<SearchNormalSm />}
        />
        <BaseSelect
          name="status"
          control={control}
          options={statusOptionsFor(direction)}
          className="w-full sm:w-48"
          classNames={filterTrigger}
          aria-label="Status"
          disallowEmptySelection
        />
        <BaseSelect
          name="payment"
          control={control}
          options={paymentOptions}
          className="w-full sm:w-44"
          classNames={filterTrigger}
          aria-label="Payment"
          disallowEmptySelection
        />
      </FilterBar>
      <Card className="mt-4">
        {/* A failed refetch keeps the last page beside the error; amounts
            that may be out of date are not shown as current. */}
        {invoices.isError ? (
          <ErrorState
            message="We couldn't load the invoices. Please try again."
            onAction={() => void invoices.refetch()}
          />
        ) : (
          <BaseTable<InvoiceView>
            ariaLabel={isReceivable ? "Shipper invoices" : "Carrier invoices"}
            columns={columnsFor(direction)}
            data={invoices.data?.items ?? []}
            loading={invoices.isPending}
            rowKey={(row) => row.id}
            renderCell={renderCell}
            meta={meta}
            setMeta={setMeta}
            sort={table.sort}
            onSortChange={table.onSortChange}
            bottomContent="Invoices"
            emptyContent="No invoices match these filters"
          />
        )}
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
