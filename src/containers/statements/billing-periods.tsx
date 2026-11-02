import { Card } from "@heroui/react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Link } from "react-router";
import { toast } from "sonner";
import {
  BaseButton,
  BaseSelect,
  BaseTable,
  CustomerInvoiceStatusChip,
  ErrorState,
  FilterBar,
  FormModal,
  Money,
  PartyAvatar,
  RowActions,
  StatusChip,
  TableSkeleton,
} from "@/components/common";
import { EyeIcon } from "@/components/icons";
import { useCan } from "@/components/providers/user-provider";
import { useServerPaging } from "@/hooks";
import { paymentTermsLabels } from "@/lib/constants";
import {
  BillingPeriodStatus,
  InvoiceKind,
  PartyType,
  PaymentStatus,
  Permission,
} from "@/lib/enums";
import { BillingPeriod, BillingPeriodInvoice, BillingPeriodRun } from "@/lib/interfaces";
import { ChipTone } from "@/components/common/status-chip";
import { BaseTableColumn } from "@/lib/types";
import { formatDate, formatDateTime } from "@/lib/utils";
import {
  ApiError,
  errorMessage,
  getBillingPeriod,
  listBillingPeriods,
  runBillingPeriods,
} from "@/services";
import PartyPicker from "../shipments/party-picker";

// Shippers' billing periods (Statements, Billing Periods tab): a NET-terms
// shipper's issued invoices grouped by period, with the notice sent before
// each one ends. Totals and balances come from the API, tax included.

const ALL = "ALL";

const statusOptions = [
  { key: ALL, label: "All periods", value: ALL },
  { key: BillingPeriodStatus.Open, label: "Open", value: BillingPeriodStatus.Open },
  { key: BillingPeriodStatus.Notified, label: "Notice sent", value: BillingPeriodStatus.Notified },
  { key: BillingPeriodStatus.Closed, label: "Closed", value: BillingPeriodStatus.Closed },
];

const periodStatus: Record<BillingPeriodStatus, { label: string; tone: ChipTone }> = {
  [BillingPeriodStatus.Open]: { label: "Open", tone: "secondary" },
  [BillingPeriodStatus.Notified]: { label: "Notice sent", tone: "primary" },
  [BillingPeriodStatus.Closed]: { label: "Closed", tone: "neutral" },
};

const PeriodStatusChip = ({ status }: { status: BillingPeriodStatus }) => (
  <StatusChip text={periodStatus[status].label} tone={periodStatus[status].tone} />
);

const columns: BaseTableColumn[] = [
  { key: "party", label: "Shipper" },
  { key: "period", label: "Period" },
  { key: "notice", label: "Notice" },
  { key: "invoices", label: "Invoices", align: "end" },
  { key: "total", label: "Total", align: "end" },
  { key: "balance", label: "Balance Due", align: "end" },
  { key: "status", label: "Status" },
  { key: "actions", label: "Actions", align: "center" },
];

const periodLabel = (period: BillingPeriod) =>
  `${formatDate(period.periodStart)} – ${formatDate(period.periodEnd)}`;

const runSummary = (run: BillingPeriodRun) =>
  [
    `${run.assigned} invoices placed`,
    `${run.opened} periods opened`,
    `${run.notified} notices sent`,
    `${run.closed} closed`,
    run.failed > 0 && `${run.failed} notices failed`,
    run.unplaced > 0 && `${run.unplaced} invoices fit no period`,
  ]
    .filter(Boolean)
    .join(", ");

export default function BillingPeriods() {
  const { can } = useCan();
  const canRun = can(Permission.ReportsSendEmail);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState<BillingPeriod | null>(null);
  const [confirmingRun, setConfirmingRun] = useState(false);
  const { control } = useForm<{ status: string; partyId: string }>({
    defaultValues: { status: ALL, partyId: "" },
  });
  const status = useWatch({ control, name: "status" });
  const partyId = useWatch({ control, name: "partyId" });
  const paging = useServerPaging(JSON.stringify([status, partyId]));

  const params = {
    page: paging.page,
    limit: paging.limit,
    partyId: partyId || undefined,
    status: status !== ALL ? (status as BillingPeriodStatus) : undefined,
  };
  const periods = useQuery({
    queryKey: ["billing-periods", "list", params],
    queryFn: ({ signal }) => listBillingPeriods(params, signal),
    placeholderData: keepPreviousData,
  });

  const run = useMutation({
    mutationFn: runBillingPeriods,
    onSuccess: (result) => {
      if (result.failed > 0 || result.unplaced > 0) {
        toast.warning(`Billing periods: ${runSummary(result)}.`);
      } else {
        toast.success(`Billing periods: ${runSummary(result)}.`);
      }
      void queryClient.invalidateQueries({ queryKey: ["billing-periods"] });
      setConfirmingRun(false);
    },
    onError: (error) => {
      toast.error(errorMessage(error));
      // 409: the daily job is already running; show where it got to.
      if (error instanceof ApiError && error.status === 409) {
        void queryClient.invalidateQueries({ queryKey: ["billing-periods"] });
      }
    },
  });

  const renderCell = (period: BillingPeriod, key: string) => {
    switch (key) {
      case "party":
        return (
          <PartyAvatar
            name={period.partyName ?? period.partyId}
            subtitle={`${paymentTermsLabels[period.paymentTerms]} · ${period.currency}`}
            tone="success"
          />
        );
      case "period":
        return <span className="whitespace-nowrap">{periodLabel(period)}</span>;
      case "notice":
        return (
          <div className="flex flex-col whitespace-nowrap">
            <span>{formatDate(period.noticeDate)}</span>
            {period.notifiedAt && (
              <span className="text-gray-500">Sent {formatDateTime(period.notifiedAt)}</span>
            )}
          </div>
        );
      case "invoices":
        return period.invoiceCount;
      case "total":
        return <Money amount={period.total} currency={period.currency} />;
      case "balance":
        return (
          <Money amount={period.balanceDue} currency={period.currency} className="font-semibold" />
        );
      case "status":
        return <PeriodStatusChip status={period.status} />;
      case "actions":
        return (
          <RowActions
            actions={[
              { key: "view", label: "View invoices", icon: <EyeIcon />, onPress: () => setOpen(period) },
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
        <div className="w-full sm:w-80">
          <PartyPicker
            control={control}
            name="partyId"
            type={PartyType.Shipper}
            label="Shipper"
          />
        </div>
        <BaseSelect
          name="status"
          control={control}
          options={statusOptions}
          className="w-full sm:w-44"
          classNames={{ trigger: "bg-white border-none h-12 rounded-lg" }}
          aria-label="Status"
          disallowEmptySelection
        />
        {canRun && (
          <BaseButton
            text="Run now"
            className="rounded-xl px-4 sm:ml-auto"
            onPress={() => setConfirmingRun(true)}
          />
        )}
      </FilterBar>

      <Card>
        {periods.isError ? (
          <ErrorState
            message={`We couldn't load the billing periods: ${errorMessage(periods.error)}`}
            onAction={() => void periods.refetch()}
          />
        ) : (
          <BaseTable<BillingPeriod>
            ariaLabel="Billing periods"
            columns={columns}
            data={periods.data?.items ?? []}
            loading={periods.isPending}
            refreshing={periods.isPlaceholderData}
            rowKey={(row) => row.id}
            renderCell={renderCell}
            meta={paging.tableMeta(periods.data?.meta)}
            setMeta={paging.setMeta}
            bottomContent="Billing periods"
            emptyContent="No billing periods"
          />
        )}
      </Card>

      <FormModal
        isOpen={confirmingRun}
        onOpenChange={(isOpen) => !isOpen && setConfirmingRun(false)}
        title="Run Billing Periods"
        confirmText="Run now"
        onConfirm={() => run.mutate()}
        isConfirming={run.isPending}
      >
        <p className="text-sm">
          This does now what the daily job does: it emails the billing-period
          notices that are due (and any that failed before), closes periods that
          have ended, and puts new issued invoices in their period.
        </p>
      </FormModal>

      {open && <BillingPeriodModal period={open} onClose={() => setOpen(null)} />}
    </>
  );
}

const invoiceColumns: BaseTableColumn[] = [
  { key: "number", label: "Invoice #" },
  { key: "invoiceDate", label: "Invoice Date" },
  { key: "dueDate", label: "Due Date" },
  { key: "total", label: "Total", align: "end" },
  { key: "balance", label: "Balance", align: "end" },
  { key: "status", label: "Status" },
];

function BillingPeriodModal({
  period,
  onClose,
}: {
  period: BillingPeriod;
  onClose: () => void;
}) {
  const detail = useQuery({
    queryKey: ["billing-periods", "detail", period.id],
    queryFn: ({ signal }) => getBillingPeriod(period.id, signal),
  });

  const renderCell = (invoice: BillingPeriodInvoice, key: string) => {
    switch (key) {
      case "number":
        return (
          <Link
            to={`/shipper-invoices/view/?id=${encodeURIComponent(invoice.id)}`}
            className="font-bold text-base-primary-300 underline"
          >
            {invoice.invoiceNumber ?? "No number yet"}
            {invoice.kind === InvoiceKind.CreditNote && " (credit note)"}
            {invoice.kind === InvoiceKind.Adjustment && " (adjustment)"}
          </Link>
        );
      case "invoiceDate":
        return formatDate(invoice.invoiceDate);
      case "dueDate":
        return invoice.dueDate ? formatDate(invoice.dueDate) : "—";
      case "total":
        return <Money amount={invoice.total} currency={period.currency} />;
      case "balance":
        return <Money amount={invoice.balanceDue} currency={period.currency} />;
      case "status":
        return (
          <div className="flex flex-wrap gap-1">
            <CustomerInvoiceStatusChip status={invoice.status} />
            {invoice.paymentStatus === PaymentStatus.Paid && (
              <StatusChip text="Paid" tone="success" />
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <FormModal
      isOpen
      onOpenChange={(isOpen) => !isOpen && onClose()}
      title={`${period.partyName ?? "Shipper"} · ${periodLabel(period)}`}
      confirmText="Done"
      size="5xl"
    >
      <p className="text-sm text-[#707070]">
        <PeriodStatusChip status={period.status} /> Notice {formatDate(period.noticeDate)}
        {period.notifiedAt && `, sent ${formatDateTime(period.notifiedAt)}`} · total{" "}
        <Money amount={period.total} currency={period.currency} /> · balance due{" "}
        <Money amount={period.balanceDue} currency={period.currency} />
      </p>
      {detail.isError ? (
        <ErrorState
          message={`We couldn't load this period's invoices: ${errorMessage(detail.error)}`}
          onAction={() => void detail.refetch()}
        />
      ) : detail.isPending ? (
        <TableSkeleton />
      ) : (
        <BaseTable<BillingPeriodInvoice>
          ariaLabel="Invoices in this billing period"
          columns={invoiceColumns}
          data={detail.data.invoices}
          rowKey={(row) => row.id}
          renderCell={renderCell}
          emptyContent="No issued invoices in this period"
        />
      )}
    </FormModal>
  );
}
