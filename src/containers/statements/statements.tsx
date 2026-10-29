import { Card, Tab, Tabs } from "@heroui/react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { HiOutlineCurrencyDollar } from "react-icons/hi2";
import { LuCalendarClock, LuRefreshCw } from "react-icons/lu";
import { PiFilePdf, PiFileXls, PiHandCoins } from "react-icons/pi";
import { toast } from "sonner";
import {
  AlertBanner,
  BaseButton,
  BaseCardWrapper,
  BaseInput,
  BaseTable,
  ErrorState,
  FilterBar,
  FormModal,
  Money,
  PartyAvatar,
  RowActions,
  StatCard,
  StatusChip,
} from "@/components/common";
import { EyeIcon, SearchNormalSm } from "@/components/icons";
import { useCan } from "@/components/providers/user-provider";
import { useDebouncedValue, useFileDownload, useServerPaging } from "@/hooks";
import { Currency, PartyType, Permission, StatementRunTrigger } from "@/lib/enums";
import { CurrencyAmounts, PartyAccountSummary, StatementRun } from "@/lib/interfaces";
import { formatMoney } from "@/lib/money";
import { BaseTableColumn } from "@/lib/types";
import { formatDate, formatDateTime } from "@/lib/utils";
import {
  ApiError,
  errorMessage,
  exportAccountSummaries,
  getDashboard,
  getStatementSchedule,
  listAccountSummaries,
  listStatementRuns,
  sendWeeklyStatements,
} from "@/services";
import StatementModal from "./statement-modal";

type View = "carriers" | "shippers";
type ListFormat = "pdf" | "xlsx";

// "2026-10-16" -> "Oct 2026". A calendar date, so read in UTC (see
// formatDate in lib/utils).
const formatMonth = (date: string) =>
  new Date(date).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

// The API lists accounts by name and has no other order, so nothing sorts.
const columnsFor = (view: View): BaseTableColumn[] => [
  { key: "party", label: view === "carriers" ? "Carrier" : "Shipper" },
  { key: "volume", label: "Business Volume", align: "end" },
  { key: "balance", label: "Remaining Balance", align: "end" },
  { key: "overdue", label: "Overdue", align: "end" },
  { key: "lastPayment", label: "Last Payment" },
  { key: "averagePaymentDays", label: "Avg. Payment Days", align: "end" },
  ...(view === "shippers" ? [{ key: "weekly", label: "Weekly Statement" }] : []),
  { key: "actions", label: "Actions", align: "center" },
];

// CAD, then USD and both in CAD. A side the role may not see, or that
// hasn't loaded, is "—", never 0.00.
const sideCard = (amounts: CurrencyAmounts | null, inCad: string | null) => ({
  value: (amounts && formatMoney(amounts.CAD, Currency.CAD)) ?? "—",
  caption: amounts
    ? `+ ${formatMoney(amounts.USD, Currency.USD) ?? "—"} · ${formatMoney(inCad, Currency.CAD) ?? "—"} in all, at invoice-date rates`
    : "",
});

const runTitle = (run: StatementRun) =>
  `${formatDate(run.ranAt)} · ${run.partyCount} shippers${
    run.trigger === StatementRunTrigger.Manual ? " · sent now" : ""
  }`;

// Requirement 2: each carrier's and shipper's account, the overall payable
// and receivable, and the Friday statement emails. Balances are live: the
// API works every figure out when it is asked.
export default function Statements() {
  const { can } = useCan();
  const canShippers = can(Permission.CustomerInvoicesView);
  const canCarriers = can(Permission.CarrierInvoicesView);
  const canSend = canShippers && can(Permission.ReportsSendEmail);
  const [chosenView, setView] = useState<View>("carriers");
  const view: View =
    chosenView === "carriers" && !canCarriers ? "shippers" : chosenView;
  const [open, setOpen] = useState<PartyAccountSummary | null>(null);
  const [confirmingSend, setConfirmingSend] = useState(false);
  const { control } = useForm<{ search: string }>({
    defaultValues: { search: "" },
  });
  const search = useDebouncedValue(useWatch({ control, name: "search" }).trim());

  const dashboard = useQuery({
    queryKey: ["accounts", "dashboard"],
    queryFn: ({ signal }) => getDashboard(signal),
  });
  // The schedule and the runs are about shipper statements.
  const schedule = useQuery({
    queryKey: ["statements", "schedule"],
    queryFn: ({ signal }) => getStatementSchedule(signal),
    enabled: canShippers,
  });
  const runs = useQuery({
    queryKey: ["statements", "runs"],
    queryFn: ({ signal }) => listStatementRuns({ page: 1, limit: 5 }, signal),
    enabled: canShippers,
  });

  const type = view === "carriers" ? PartyType.Carrier : PartyType.Shipper;
  const searchQuery = search.slice(0, 100);
  const paging = useServerPaging(JSON.stringify([view, searchQuery]));
  const params = { page: paging.page, limit: paging.limit, type, searchQuery };
  const summaries = useQuery({
    queryKey: ["accounts", "summaries", params],
    queryFn: ({ signal }) => listAccountSummaries(params, signal),
    placeholderData: keepPreviousData,
  });

  const queryClient = useQueryClient();
  const sendNow = useMutation({
    mutationFn: sendWeeklyStatements,
    onSuccess: (run) => {
      const queued = run.queuedCount ? `, ${run.queuedCount} saved but not emailed` : "";
      const failed = run.failedCount ? `, ${run.failedCount} failed` : "";
      toast.success(`Weekly statements: ${run.sentCount} sent${queued}${failed}.`);
      void queryClient.invalidateQueries({ queryKey: ["statements"] });
      setConfirmingSend(false);
    },
    onError: (error) => {
      toast.error(errorMessage(error));
      // 409: a run is already going; show it.
      if (error instanceof ApiError && error.status === 409) {
        void queryClient.invalidateQueries({ queryKey: ["statements"] });
      }
    },
  });

  const listName = view === "carriers" ? "carrier-statements" : "shipper-statements";
  const exportList = useFileDownload((format: ListFormat) =>
    exportAccountSummaries({ type, searchQuery }, format, `${listName}.${format}`)
  );
  const exporting = (format: ListFormat) =>
    exportList.isPending && exportList.variables === format;

  const d = dashboard.data;
  const s = schedule.data;
  const cards = [
    {
      icon: <HiOutlineCurrencyDollar className="text-[#45D483]" />,
      iconBgClass: "bg-icon-lightGreen",
      name: "Overall Shipper Receivable",
      ...sideCard(d?.receivable ?? null, d?.receivableInCad ?? null),
    },
    {
      icon: <PiHandCoins className="text-base-primary-200" />,
      iconBgClass: "bg-icon-lightDarkBlue",
      name: "Overall Carrier Payable",
      ...sideCard(d?.payable ?? null, d?.payableInCad ?? null),
    },
    {
      icon: <LuRefreshCw className="text-[#BC8EF0]" />,
      iconBgClass: "bg-icon-lightPurple",
      name: "Balances",
      value: "Live",
      caption: s
        ? `As of ${formatDateTime(s.asOf) ?? "—"}`
        : "Worked out each time the page loads",
    },
    {
      icon: <LuCalendarClock className="text-[#F871A0]" />,
      iconBgClass: "bg-icon-lightRed",
      name: "Next Weekly Statements",
      value: formatDateTime(s?.nextWeeklyRun) ?? "—",
      caption: s
        ? `Every Friday at 08:00 to ${s.weeklyShipperCount} shippers`
        : "Every Friday at 08:00",
    },
  ];

  const renderCell = (row: PartyAccountSummary, key: string) => {
    switch (key) {
      case "party":
        return (
          <PartyAvatar
            name={row.partyName}
            subtitle={row.currency}
            tone={row.type === PartyType.Shipper ? "success" : "primary"}
          />
        );
      case "volume":
        return (
          <div className="flex flex-col">
            <Money amount={row.businessVolume} currency={row.currency} />
            <span className="text-gray-500">{row.shipmentCount} shipments</span>
          </div>
        );
      case "balance":
        return <Money amount={row.balance} currency={row.currency} className="font-semibold" />;
      case "overdue":
        return row.oldestOverdueDays > 0 ? (
          <div className="flex flex-col items-start gap-1">
            <Money amount={row.overdue} currency={row.currency} />
            <StatusChip text={`${row.oldestOverdueDays} days past due`} tone="danger" />
          </div>
        ) : (
          <span className="text-gray-400">None</span>
        );
      case "lastPayment":
        return row.lastPayment ? (
          <div className="flex flex-col whitespace-nowrap">
            <span className="font-semibold">{formatMonth(row.lastPayment.paidOn)}</span>
            <span className="text-gray-500">
              {row.lastPayment.invoiceRef ?? "Not allocated yet"} ·{" "}
              {row.lastPayment.paymentNumber}
            </span>
            <Money amount={row.lastPayment.amount} currency={row.currency} />
          </div>
        ) : (
          <span className="text-gray-400">No payments yet</span>
        );
      case "averagePaymentDays":
        return row.averagePaymentDays === null ? (
          <span className="text-gray-400">—</span>
        ) : (
          `${row.averagePaymentDays} days`
        );
      case "weekly":
        return row.weeklyStatement ? (
          <StatusChip text="On" tone="success" />
        ) : (
          <StatusChip text="Off" tone="neutral" />
        );
      case "actions":
        return (
          <RowActions
            actions={[
              { key: "view", label: "View statement", icon: <EyeIcon />, onPress: () => setOpen(row) },
            ]}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {s && !s.emailEnabled && (
        <AlertBanner message="Email is switched off: statements are saved but not emailed." />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((card) => (
          <StatCard key={card.name} card={card} />
        ))}
      </div>

      <div className="flex flex-wrap justify-between items-end gap-3">
        <Tabs
          aria-label="Statements view"
          color="primary"
          variant="underlined"
          selectedKey={view}
          onSelectionChange={(key) => setView(key as View)}
          classNames={{ base: "max-w-full", cursor: "bg-base-primary" }}
        >
          {canCarriers && <Tab key="carriers" title="Carriers (payable)" />}
          {canShippers && <Tab key="shippers" title="Shippers (receivable)" />}
        </Tabs>
        <div className="flex gap-2">
          {can(Permission.ReportsExportCsv) && (
            <BaseButton
              text="Excel"
              varient="bordered"
              className="text-base-primary rounded-xl px-3"
              startContent={<PiFileXls className="text-lg" />}
              isLoading={exporting("xlsx")}
              onPress={() => exportList.mutate("xlsx")}
            />
          )}
          {can(Permission.ReportsExportPdf) && (
            <BaseButton
              text="PDF"
              varient="bordered"
              className="text-base-primary rounded-xl px-3"
              startContent={<PiFilePdf className="text-lg" />}
              isLoading={exporting("pdf")}
              onPress={() => exportList.mutate("pdf")}
            />
          )}
        </div>
      </div>

      <FilterBar>
        <BaseInput
          name="search"
          control={control}
          className="max-w-sm"
          classNames={{ inputWrapper: "bg-[#FFFFFF66] h-12 border-1 rounded-lg" }}
          placeholder={view === "carriers" ? "Search carriers by name" : "Search shippers by name"}
          endContent={<SearchNormalSm />}
        />
      </FilterBar>

      <Card>
        {summaries.isError ? (
          <ErrorState
            message="We couldn't load the accounts. Please try again."
            onAction={() => void summaries.refetch()}
          />
        ) : (
          <BaseTable<PartyAccountSummary>
            ariaLabel={view === "carriers" ? "Carrier statements" : "Shipper statements"}
            columns={columnsFor(view)}
            data={summaries.data?.items ?? []}
            loading={summaries.isPending}
            refreshing={summaries.isPlaceholderData}
            rowKey={(row) => row.partyId}
            renderCell={renderCell}
            meta={paging.tableMeta(summaries.data?.meta)}
            setMeta={paging.setMeta}
            bottomContent={view === "carriers" ? "Carriers" : "Shippers"}
            emptyContent={searchQuery ? "No accounts match this search" : "No accounts yet"}
          />
        )}
      </Card>

      {canShippers && (
        <BaseCardWrapper
          heading="Weekly Shipper Statements"
          action={
            canSend && (
              <BaseButton
                text="Send now"
                className="rounded-xl px-4"
                onPress={() => setConfirmingSend(true)}
              />
            )
          }
        >
          <p className="text-sm text-[#343A40] mb-4">
            Emailed every Friday at 08:00 (Toronto time) to the{" "}
            {s?.weeklyShipperCount ?? "—"} shippers with weekly statements on.
            Next run <strong>{formatDateTime(s?.nextWeeklyRun) ?? "—"}</strong>.
          </p>
          {runs.isError ? (
            <ErrorState
              message="We couldn't load the statement runs. Please try again."
              onAction={() => void runs.refetch()}
            />
          ) : runs.data?.items.length === 0 ? (
            <p className="text-sm text-gray-500">No weekly runs yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {runs.data?.items.map((run) => (
                <li
                  key={run.id}
                  className="flex flex-wrap justify-between items-center gap-2 text-sm border-b border-gray-100 pb-2"
                >
                  <span>{runTitle(run)}</span>
                  <div className="flex flex-wrap gap-1">
                    <StatusChip text={`${run.sentCount} sent`} tone="success" />
                    {run.queuedCount > 0 && (
                      <StatusChip text={`${run.queuedCount} saved, not emailed`} tone="warning" />
                    )}
                    {run.skippedCount > 0 && (
                      <StatusChip text={`${run.skippedCount} already sent`} tone="neutral" />
                    )}
                    {run.failedCount > 0 && (
                      <StatusChip text={`${run.failedCount} failed`} tone="danger" />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </BaseCardWrapper>
      )}

      <FormModal
        isOpen={confirmingSend}
        onOpenChange={(isOpen) => !isOpen && setConfirmingSend(false)}
        title="Send Weekly Statements"
        confirmText="Send now"
        onConfirm={() => sendNow.mutate()}
        isConfirming={sendNow.isPending}
      >
        <p className="text-sm">
          This week&apos;s statement goes now to the{" "}
          {s?.weeklyShipperCount ?? "—"} shippers with weekly statements on,
          including any that already had Friday&apos;s.
        </p>
      </FormModal>

      {open && <StatementModal summary={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
