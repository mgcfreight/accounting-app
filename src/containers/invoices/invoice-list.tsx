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
import { useCan } from "@/components/providers/user-provider";
import { useDebouncedValue, useServerPaging } from "@/hooks";
import {
  CarrierInvoiceStatus,
  CustomerInvoiceStatus,
  InvoiceDirection,
  InvoiceSortBy,
  PaymentStatus,
  SortOrder,
} from "@/lib/enums";
import { Paginated } from "@/lib/interfaces";
import { BaseTableColumn, TableSort } from "@/lib/types";
import { humanize } from "@/lib/utils";
import {
  CarrierInvoiceListParams,
  CustomerInvoiceListParams,
  listCarrierInvoices,
  listCustomerInvoices,
} from "@/services";
import usePartyNames from "../parties/use-party-names";
import InvoiceActionModal, { InvoiceAction } from "./invoice-action-modal";
import { availableActions } from "./invoice-row-actions";
import InvoiceViewCell, {
  apiInvoiceHref,
  carrierIdsOf,
  InvoiceView,
  partyOf,
} from "./invoice-view";

type Filters = { search: string; status: string; payment: string };

const ALL = "ALL";

// Without a status the API lists every one but SUPERSEDED: old versions are
// listed only when asked for.
const statusLabels: Record<string, string> = {
  [CarrierInvoiceStatus.Expected]: "Awaiting bill",
  [CarrierInvoiceStatus.OnHold]: "On hold",
  [CustomerInvoiceStatus.Superseded]: "Replaced",
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
  const { can } = useCan();
  const isReceivable = direction === InvoiceDirection.Receivable;
  const [active, setActive] = useState<{
    action: InvoiceAction;
    invoice: InvoiceView;
  } | null>(null);
  const [sort, setSort] = useState<TableSort | null>(null);
  const { control } = useForm<Filters>({
    defaultValues: { search: "", status: ALL, payment: ALL },
  });
  const search = useDebouncedValue(useWatch({ control, name: "search" }).trim());
  const status = useWatch({ control, name: "status" });
  const payment = useWatch({ control, name: "payment" });

  const paging = useServerPaging(
    JSON.stringify([direction, search, status, payment, sort])
  );
  const params = {
    page: paging.page,
    limit: paging.limit,
    searchQuery: search.slice(0, 64),
    status: status && status !== ALL ? status : undefined,
    paymentStatus:
      payment && payment !== ALL ? (payment as PaymentStatus) : undefined,
    sortBy: sort?.sortKey as InvoiceSortBy | undefined,
    order: sort?.direction === "desc" ? SortOrder.Desc : SortOrder.Asc,
  };

  const invoices = useQuery({
    queryKey: ["invoices", direction, "list", params],
    queryFn: ({ signal }): Promise<Paginated<InvoiceView>> =>
      isReceivable
        ? listCustomerInvoices(params as CustomerInvoiceListParams, signal)
        : listCarrierInvoices(params as CarrierInvoiceListParams, signal),
    placeholderData: keepPreviousData,
  });
  const rows = invoices.data?.items ?? [];
  const carriers = usePartyNames(carrierIdsOf(rows));

  const renderCell = (invoice: InvoiceView, key: string) => {
    if (key !== "actions") {
      return (
        <InvoiceViewCell invoice={invoice} columnKey={key} parties={carriers} />
      );
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
          // A new version starts from the invoice's lines, which only the
          // invoice page has: it's offered there.
          ...availableActions(invoice, can)
            .filter((action) => action.key !== "revise")
            .map((action) => ({
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
            data={rows}
            loading={invoices.isPending}
            rowKey={(row) => row.id}
            renderCell={renderCell}
            meta={paging.tableMeta(invoices.data?.meta)}
            setMeta={paging.setMeta}
            sort={sort}
            onSortChange={setSort}
            bottomContent="Invoices"
            emptyContent="No invoices match these filters"
          />
        )}
      </Card>
      {active && (
        <InvoiceActionModal
          action={active.action}
          invoice={active.invoice}
          partyName={partyOf(active.invoice, carriers).name}
          onClose={() => setActive(null)}
        />
      )}
    </>
  );
}
