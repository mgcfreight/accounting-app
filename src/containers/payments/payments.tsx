import { Card, Tab, Tabs } from "@heroui/react";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import {
  BaseInput,
  BaseSelect,
  BaseTable,
  DirectionChip,
  FilterBar,
  MatchStatusChip,
  Money,
  PartyAvatar,
  RowActions,
  StatusChip,
} from "@/components/common";
import { SearchNormalSm } from "@/components/icons";
import { useHeaderAction } from "@/components/providers/header-action-provider";
import { useCan } from "@/components/providers/user-provider";
import { useClientTable } from "@/hooks";
import { paymentMethodLabel, paymentMethodOptions } from "@/lib/constants";
import { MatchStatus, PaymentDirection, Permission } from "@/lib/enums";
import { Payment } from "@/lib/interfaces";
import { mockPayments } from "@/lib/mock";
import { isZeroMoney } from "@/lib/money";
import { BaseTableColumn } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import RecordPaymentModal from "./record-payment-modal";

type Filters = { search: string; method: string };
type View = "all" | "in" | "out" | "unmatched";

const columns: BaseTableColumn[] = [
  { key: "number", label: "Payment #", sortable: true },
  { key: "party", label: "Party", sortable: true, sortKey: "partyName" },
  { key: "direction", label: "Direction" },
  { key: "method", label: "Method" },
  { key: "reference", label: "Reference" },
  { key: "paidOn", label: "Paid On", sortable: true, sortType: "date" },
  { key: "amount", label: "Amount", sortable: true, sortType: "money" },
  { key: "unapplied", label: "Unapplied", sortType: "money" },
  { key: "match", label: "Match" },
  { key: "actions", label: "" },
];

const methodOptions = [
  { key: "ALL", label: "All methods", value: "ALL" },
  ...paymentMethodOptions,
];

// Design §8.5 and §9: record payments, auto-match, manual allocation, and the
// "Unmatched" list.
export default function Payments() {
  const [view, setView] = useState<View>("all");
  const [recording, setRecording] = useState(false);
  const { control } = useForm<Filters>({
    defaultValues: { search: "", method: "ALL" },
  });
  const search = useWatch({ control, name: "search" }).trim().toLowerCase();
  const method = useWatch({ control, name: "method" });

  // The header's "Record Payment" button (routes.config.ts).
  useHeaderAction("record-payment", () => setRecording(true));

  // Money in and money out are separate permissions; the page opens with
  // either, and shows only the sides the role may view.
  const { can } = useCan();
  const canViewIn = can(Permission.CustomerPaymentsView);
  const canViewOut = can(Permission.CarrierPaymentsView);
  const visible = useMemo(
    () =>
      mockPayments.filter((p) =>
        p.direction === PaymentDirection.In ? canViewIn : canViewOut
      ),
    [canViewIn, canViewOut]
  );
  // Allocating is part of recording a payment; there is no separate edit.
  const canRecord = (direction: PaymentDirection) =>
    can(
      direction === PaymentDirection.In
        ? Permission.CustomerPaymentsCreate
        : Permission.CarrierPaymentsCreate
    );

  const counts = {
    all: visible.length,
    in: visible.filter((p) => p.direction === PaymentDirection.In).length,
    out: visible.filter((p) => p.direction === PaymentDirection.Out).length,
    unmatched: visible.filter((p) => p.match === MatchStatus.Unmatched)
      .length,
  };

  const filtered = useMemo(
    () =>
      visible.filter((payment) => {
        if (view === "in" && payment.direction !== PaymentDirection.In) return false;
        if (view === "out" && payment.direction !== PaymentDirection.Out) return false;
        if (view === "unmatched" && payment.match !== MatchStatus.Unmatched) {
          return false;
        }
        if (method && method !== "ALL" && payment.method !== method) return false;
        if (!search) return true;
        return [payment.number, payment.partyName, payment.reference].some(
          (value) => value.toLowerCase().includes(search)
        );
      }),
    [visible, view, method, search]
  );

  const table = useClientTable(filtered, columns, {
    column: "paidOn",
    sortKey: "paidOn",
    direction: "desc",
  });

  const renderCell = (payment: Payment, key: string) => {
    switch (key) {
      case "number":
        return <span className="font-bold text-base-primary-300">{payment.number}</span>;
      case "party":
        return (
          <PartyAvatar
            name={payment.partyName}
            subtitle={payment.source === "MGC_STRIPE" ? "Stripe via MGC" : "Recorded by staff"}
            tone={payment.direction === PaymentDirection.In ? "success" : "primary"}
          />
        );
      case "direction":
        return <DirectionChip direction={payment.direction} />;
      case "method":
        return paymentMethodLabel(payment.method);
      case "reference":
        return <span className="font-mono">{payment.reference}</span>;
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
        return <MatchStatusChip status={payment.match} />;
      case "actions":
        if (payment.match === MatchStatus.Unmatched && !canRecord(payment.direction)) {
          return null;
        }
        return (
          <RowActions
            actions={
              payment.match === MatchStatus.Unmatched
                ? [
                    {
                      key: "allocate",
                      label: "Allocate to invoices",
                      onPress: () =>
                        toast.info("Manual allocation — demo only, nothing was saved."),
                    },
                    {
                      key: "credit",
                      label: "Keep as unapplied credit",
                      onPress: () =>
                        toast.info("Unapplied credit — demo only, nothing was saved."),
                    },
                  ]
                : [
                    {
                      key: "view",
                      label: "View allocation",
                      onPress: () =>
                        toast.info(`${payment.number} is fully allocated (demo).`),
                    },
                  ]
            }
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
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
          tabList: "mb-4",
          cursor: "bg-base-primary",
        }}
      >
        <Tab key="all" title={`All (${counts.all})`} />
        <Tab key="in" title={`Money in (${counts.in})`} />
        <Tab key="out" title={`Money out (${counts.out})`} />
        <Tab
          key="unmatched"
          title={
            <div className="flex items-center gap-2">
              Unmatched
              <StatusChip text={`${counts.unmatched}`} tone="warning" className="px-2 py-0" />
            </div>
          }
        />
      </Tabs>
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
      <Card className="mt-4">
        <BaseTable
          ariaLabel="Payments"
          columns={columns}
          data={table.pageRows}
          rowKey={(row) => row.id}
          renderCell={renderCell}
          meta={table.meta}
          setMeta={table.setMeta}
          sort={table.sort}
          onSortChange={table.onSortChange}
          bottomContent="Payments"
        />
      </Card>
      <RecordPaymentModal isOpen={recording} onClose={() => setRecording(false)} />
    </>
  );
}
