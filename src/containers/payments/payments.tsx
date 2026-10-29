import { Card, Tab, Tabs } from "@heroui/react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import {
  BaseInput,
  BaseSelect,
  BaseTable,
  DirectionChip,
  ErrorState,
  FilterBar,
  MatchStatusChip,
  Money,
  PartyAvatar,
  RowActions,
  StatusChip,
} from "@/components/common";
import { EyeIcon, SearchNormalSm } from "@/components/icons";
import { useHeaderAction } from "@/components/providers/header-action-provider";
import { useCan } from "@/components/providers/user-provider";
import { useDebouncedValue, useServerPaging } from "@/hooks";
import { paymentMethodLabel, paymentMethodOptions } from "@/lib/constants";
import {
  PaymentDirection,
  PaymentMethod,
  PaymentRecordStatus,
  PaymentSortBy,
  Permission,
  SortOrder,
} from "@/lib/enums";
import { Payment } from "@/lib/interfaces";
import { mockInstallmentPlans } from "@/lib/mock";
import { isZeroMoney } from "@/lib/money";
import { BaseTableColumn, TableSort } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { listPayments, PaymentListParams } from "@/services";
import {
  AllocateModal,
  matchedBy,
  partyLabel,
  ReversePaymentModal,
  ViewAllocationModal,
} from "./allocation-modals";
import InstallmentPlans from "./installment-plans";
import RecordPaymentModal from "./record-payment-modal";

type Filters = { search: string; method: string };
type View = "all" | "in" | "out" | "unmatched" | "plans";
type OpenModal = { modal: "allocate" | "view" | "reverse"; payment: Payment };

const ALL = "ALL";

// Sortable columns sort on the server: `sortKey` is the API's sortBy.
const columns: BaseTableColumn[] = [
  { key: "number", label: "Payment #" },
  { key: "party", label: "Party" },
  { key: "direction", label: "Direction" },
  { key: "method", label: "Method" },
  { key: "reference", label: "Reference" },
  { key: "paidOn", label: "Paid On", sortable: true, sortKey: PaymentSortBy.PaymentDate },
  { key: "amount", label: "Amount", sortable: true, sortKey: PaymentSortBy.Amount, align: "end" },
  { key: "unapplied", label: "Unapplied", sortable: true, sortKey: PaymentSortBy.Unapplied, align: "end" },
  { key: "match", label: "Match" },
  { key: "matchedBy", label: "How Matched" },
  { key: "actions", label: "Actions", align: "center" },
];

const methodOptions = [
  { key: ALL, label: "All methods", value: ALL },
  ...paymentMethodOptions,
];

// What each tab asks the API for.
const viewParams: Record<
  Exclude<View, "plans">,
  Pick<PaymentListParams, "direction" | "unappliedOnly">
> = {
  all: {},
  in: { direction: PaymentDirection.In },
  out: { direction: PaymentDirection.Out },
  unmatched: { unappliedOnly: true },
};

// How many payments a tab holds: one row is enough to read the total.
const useTabCount = (
  params: Pick<PaymentListParams, "direction" | "unappliedOnly">,
  enabled: boolean
) =>
  useQuery({
    queryKey: ["payments", "count", params],
    queryFn: ({ signal }) =>
      listPayments({ page: 1, limit: 1, ...params }, signal),
    enabled,
    select: (page) => page.meta.totalItems,
  });

// Design §8.5 and §9: record payments, auto-match, manual allocation, the
// "Unmatched" list, and installment plans. Payments are listed, filtered,
// sorted and paged by the API; installment plans are still a demo.
export default function Payments() {
  const [view, setView] = useState<View>("all");
  const [recording, setRecording] = useState(false);
  const [open, setOpen] = useState<OpenModal | null>(null);
  const [sort, setSort] = useState<TableSort | null>(null);
  const { control } = useForm<Filters>({
    defaultValues: { search: "", method: ALL },
  });
  const search = useDebouncedValue(useWatch({ control, name: "search" }).trim());
  const method = useWatch({ control, name: "method" });

  // The header's "Record Payment" button (routes.config.ts).
  useHeaderAction("record-payment", () => setRecording(true));

  // Money in and money out are separate permissions; the page opens with
  // either, and the API lists only the sides the role may view.
  const { can } = useCan();
  const canViewIn = can(Permission.CustomerPaymentsView);
  const canViewOut = can(Permission.CarrierPaymentsView);
  const plans = useMemo(
    () =>
      mockInstallmentPlans.filter((plan) =>
        plan.direction === PaymentDirection.In ? canViewIn : canViewOut
      ),
    [canViewIn, canViewOut]
  );
  const isIn = (direction: PaymentDirection) => direction === PaymentDirection.In;
  const canRecord = (direction: PaymentDirection) =>
    can(isIn(direction) ? Permission.CustomerPaymentsCreate : Permission.CarrierPaymentsCreate);
  const canVoid = (direction: PaymentDirection) =>
    can(isIn(direction) ? Permission.CustomerPaymentsVoid : Permission.CarrierPaymentsVoid);
  // Sides the role may both see and record, for a new installment plan.
  const plannable = [PaymentDirection.In, PaymentDirection.Out].filter(
    (direction) => canRecord(direction) && (isIn(direction) ? canViewIn : canViewOut)
  );

  const counts = {
    all: useTabCount(viewParams.all, true).data,
    in: useTabCount(viewParams.in, canViewIn).data,
    out: useTabCount(viewParams.out, canViewOut).data,
    unmatched: useTabCount(viewParams.unmatched, true).data,
  };
  const countText = (count: number | undefined) =>
    count === undefined ? "" : ` (${count})`;

  const listView = view === "plans" ? "all" : view;
  const paging = useServerPaging(JSON.stringify([listView, search, method, sort]));
  const params: PaymentListParams = {
    page: paging.page,
    limit: paging.limit,
    ...viewParams[listView],
    searchQuery: search.slice(0, 64),
    method: method && method !== ALL ? (method as PaymentMethod) : undefined,
    sortBy: sort?.sortKey as PaymentSortBy | undefined,
    order: sort?.direction === "desc" ? SortOrder.Desc : SortOrder.Asc,
  };
  const payments = useQuery({
    queryKey: ["payments", "list", params],
    queryFn: ({ signal }) => listPayments(params, signal),
    placeholderData: keepPreviousData,
    enabled: view !== "plans",
  });

  const actionsFor = (payment: Payment) => {
    const reversed = payment.status === PaymentRecordStatus.Reversed;
    return [
      ...(!reversed && !isZeroMoney(payment.unapplied) && canRecord(payment.direction)
        ? [
            {
              key: "allocate",
              label: "Allocate to invoices",
              onPress: () => setOpen({ modal: "allocate", payment }),
            },
          ]
        : []),
      {
        key: "view",
        label: "View allocation",
        icon: <EyeIcon />,
        onPress: () => setOpen({ modal: "view", payment }),
      },
      ...(!reversed && canVoid(payment.direction)
        ? [
            {
              key: "reverse",
              label: "Reverse payment",
              onPress: () => setOpen({ modal: "reverse", payment }),
            },
          ]
        : []),
    ];
  };

  const renderCell = (payment: Payment, key: string) => {
    switch (key) {
      case "number":
        return <span className="font-bold text-base-primary-300">{payment.number}</span>;
      case "party":
        return (
          <PartyAvatar
            name={partyLabel(payment)}
            subtitle={payment.source === "MGC_STRIPE" ? "Stripe via MGC" : "Recorded by staff"}
            tone={isIn(payment.direction) ? "success" : "primary"}
          />
        );
      case "direction":
        return <DirectionChip direction={payment.direction} />;
      case "method":
        return paymentMethodLabel(payment.method);
      case "reference":
        return payment.reference ? (
          <span className="font-mono">{payment.reference}</span>
        ) : (
          <span className="text-gray-400">—</span>
        );
      case "paidOn":
        return <span className="whitespace-nowrap">{formatDate(payment.paidOn)}</span>;
      case "amount":
        return <Money amount={payment.amount} currency={payment.currency} className="font-semibold" />;
      case "unapplied":
        return isZeroMoney(payment.unapplied) ? (
          <span className="text-gray-400">—</span>
        ) : (
          <Money amount={payment.unapplied} currency={payment.currency} />
        );
      case "match":
        return payment.status === PaymentRecordStatus.Reversed ? (
          <StatusChip text="Reversed" tone="danger" />
        ) : (
          <MatchStatusChip status={payment.match} />
        );
      case "matchedBy": {
        const how = matchedBy(payment);
        return how ? (
          <span className="whitespace-nowrap">{how}</span>
        ) : (
          <span className="text-gray-400">—</span>
        );
      }
      case "actions":
        return <RowActions actions={actionsFor(payment)} />;
      default:
        return null;
    }
  };

  const close = () => setOpen(null);

  return (
    <div className="flex flex-col gap-6">
      <Tabs
        aria-label="Payments view"
        color="primary"
        variant="underlined"
        selectedKey={view}
        onSelectionChange={(key) => setView(key as View)}
        // `base` is inline-flex and grows to fit every tab, which widens the
        // page on a phone; capped, the tab list scrolls instead.
        classNames={{
          base: "max-w-full",
          cursor: "bg-base-primary",
        }}
      >
        <Tab key="all" title={`All${countText(counts.all)}`} />
        {canViewIn && <Tab key="in" title={`Money in${countText(counts.in)}`} />}
        {canViewOut && <Tab key="out" title={`Money out${countText(counts.out)}`} />}
        <Tab
          key="unmatched"
          title={
            <div className="flex items-center gap-2">
              Unmatched
              {counts.unmatched !== undefined && (
                <StatusChip text={`${counts.unmatched}`} tone="warning" className="px-2 py-0" />
              )}
            </div>
          }
        />
        <Tab key="plans" title={`Installment plans (${plans.length})`} />
      </Tabs>
      {view === "plans" ? (
        <InstallmentPlans plans={plans} directions={plannable} />
      ) : (
        <>
          <FilterBar>
            <BaseInput
              name="search"
              control={control}
              className="max-w-sm"
              classNames={{ inputWrapper: "bg-[#FFFFFF66] h-12 border-1 rounded-lg" }}
              placeholder="Search by payment #, party or reference"
              endContent={<SearchNormalSm />}
            />
            <BaseSelect
              name="method"
              control={control}
              options={methodOptions}
              className="w-full sm:w-48"
              classNames={{ trigger: "bg-white border-none h-12 rounded-lg" }}
              aria-label="Method"
              disallowEmptySelection
            />
          </FilterBar>
          <Card>
            {/* A failed refetch keeps the last page beside the error; amounts
                that may be out of date are not shown as current. */}
            {payments.isError ? (
              <ErrorState
                message="We couldn't load the payments. Please try again."
                onAction={() => void payments.refetch()}
              />
            ) : (
              <BaseTable<Payment>
                ariaLabel="Payments"
                columns={columns}
                data={payments.data?.items ?? []}
                loading={payments.isPending}
                refreshing={payments.isPlaceholderData}
                rowKey={(row) => row.id}
                renderCell={renderCell}
                meta={paging.tableMeta(payments.data?.meta)}
                setMeta={paging.setMeta}
                sort={sort}
                onSortChange={setSort}
                bottomContent="Payments"
                emptyContent="No payments match these filters"
              />
            )}
          </Card>
        </>
      )}
      <RecordPaymentModal isOpen={recording} onClose={() => setRecording(false)} />
      {open?.modal === "allocate" && <AllocateModal payment={open.payment} onClose={close} />}
      {open?.modal === "view" && <ViewAllocationModal payment={open.payment} onClose={close} />}
      {open?.modal === "reverse" && <ReversePaymentModal payment={open.payment} onClose={close} />}
    </div>
  );
}
