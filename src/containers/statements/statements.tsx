import { Card, Tab, Tabs } from "@heroui/react";
import { useMemo, useState } from "react";
import { HiOutlineCurrencyDollar } from "react-icons/hi2";
import { LuSend } from "react-icons/lu";
import {
  PiArrowsClockwise,
  PiCalendarDots,
  PiFilePdf,
  PiFileXls,
  PiHandCoins,
} from "react-icons/pi";
import { toast } from "sonner";
import {
  AlertBanner,
  BaseButton,
  BaseCardWrapper,
  BaseTable,
  FormModal,
  Money,
  PartyAvatar,
  RowActions,
  StatCard,
  StatusChip,
} from "@/components/common";
import { EyeIcon } from "@/components/icons";
import { useCan } from "@/components/providers/user-provider";
import { useClientTable } from "@/hooks";
import { Currency, PartyType, Permission, StatementRunKind } from "@/lib/enums";
import { ExportTable } from "@/lib/export";
import { PartyAccountSummary } from "@/lib/interfaces";
import {
  mockAccountSummaries,
  mockDashboard,
  mockStatementRuns,
  nextMonthEndStatementRun,
  nextWeeklyStatementRun,
} from "@/lib/mock";
import { formatMoney } from "@/lib/money";
import { BaseTableColumn } from "@/lib/types";
import { formatDate, formatDateTime } from "@/lib/utils";
import { exportTable, ExportFormat, moneyText } from "../reports/export-table";
import StatementModal from "./statement-modal";

type View = "carriers" | "shippers";

const viewTitles: Record<View, string> = {
  carriers: "Carriers (payable)",
  shippers: "Shippers (receivable)",
};

// "2026-10-16" -> "Oct 2026". A calendar date, so read in UTC (see
// formatDate in lib/utils).
const formatMonth = (date: string) =>
  new Date(date).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

const columnsFor = (view: View): BaseTableColumn[] => [
  { key: "party", label: view === "carriers" ? "Carrier" : "Shipper", sortable: true, sortKey: "partyName" },
  { key: "volume", label: "Business Volume", sortable: true, sortKey: "businessVolume", sortType: "money", align: "end" },
  { key: "balance", label: "Remaining Balance", sortable: true, sortType: "money", align: "end" },
  { key: "overdue", label: "Overdue", sortable: true, sortType: "money", align: "end" },
  { key: "lastPayment", label: "Last Payment", sortable: true, sortKey: "lastPayment.paidOn", sortType: "date" },
  { key: "averagePaymentDays", label: "Avg. Payment Days", sortable: true, sortType: "number", align: "end" },
  ...(view === "shippers" ? [{ key: "weekly", label: "Statement Emails" }] : []),
  { key: "actions", label: "Actions", align: "center" },
];

const lastPaymentText = (row: PartyAccountSummary) =>
  row.lastPayment
    ? `${formatMonth(row.lastPayment.paidOn)} · ${row.lastPayment.invoiceRef ?? "not allocated yet"} · ${moneyText(row.lastPayment.amount, row.currency)} (${row.lastPayment.paymentNumber})`
    : "No payments yet";

const exportFor = (
  view: View,
  rows: PartyAccountSummary[],
  asOf: string | undefined
): ExportTable<PartyAccountSummary> => ({
  title: view === "carriers" ? "Carrier statements" : "Shipper statements",
  subtitle: `As of ${formatDateTime(asOf) ?? "the last refresh"} · demo data`,
  columns: [
    { label: view === "carriers" ? "Carrier" : "Shipper", value: (row) => row.partyName },
    { label: "Business volume", value: (row) => moneyText(row.businessVolume, row.currency) },
    { label: "Shipments", value: (row) => String(row.shipmentCount) },
    { label: "Remaining balance", value: (row) => moneyText(row.balance, row.currency) },
    { label: "Overdue", value: (row) => moneyText(row.overdue, row.currency) },
    { label: "Days past due", value: (row) => (row.oldestOverdueDays > 0 ? String(row.oldestOverdueDays) : "") },
    { label: "Last payment", value: lastPaymentText },
    {
      label: "Avg. payment days",
      value: (row) => (row.averagePaymentDays === null ? "" : String(row.averagePaymentDays)),
    },
    ...(view === "shippers"
      ? [
          {
            label: "Statement emails",
            value: (row: PartyAccountSummary) => (row.weeklyStatement ? "On" : "Off"),
          },
        ]
      : []),
  ],
  rows,
});

// Requirement 2: each carrier's and shipper's account, refreshed daily, the
// overall payable and receivable, and the Friday and month-end statement
// emails. Demo data until the API has statements; the exports are real files
// of these figures.
export default function Statements() {
  const [selected, setView] = useState<View>("carriers");
  const [open, setOpen] = useState<PartyAccountSummary | null>(null);
  const [confirmSend, setConfirmSend] = useState(false);
  const { can } = useCan();
  const d = mockDashboard;

  // Only the sides the role may view, as on Reminders. Advisory only: the API
  // decides what each role gets.
  const canViewShipper = can(Permission.CustomerInvoicesView);
  const canViewCarrier = can(Permission.CarrierInvoicesView);
  const views: View[] = [
    ...(canViewCarrier ? (["carriers"] as const) : []),
    ...(canViewShipper ? (["shippers"] as const) : []),
  ];
  const view = views.includes(selected) ? selected : (views[0] ?? "carriers");
  const canViewSide = views.includes(view);

  // Newest first.
  const lastRefresh = mockStatementRuns.find(
    (run) => run.kind === StatementRunKind.DailyRefresh
  )?.ranAt;
  const emailRuns = mockStatementRuns.filter(
    (run) => run.kind !== StatementRunKind.DailyRefresh
  );
  const weeklyShippers = mockAccountSummaries.filter(
    (row) => row.type === PartyType.Shipper && row.weeklyStatement
  ).length;

  const rows = useMemo(
    () =>
      canViewSide
        ? mockAccountSummaries.filter((row) =>
            view === "carriers"
              ? row.type === PartyType.Carrier
              : row.type === PartyType.Shipper
          )
        : [],
    [view, canViewSide]
  );
  const columns = useMemo(() => columnsFor(view), [view]);
  const table = useClientTable(rows, columns, {
    column: "balance",
    sortKey: "balance",
    direction: "desc",
  });

  const runExport = (format: ExportFormat) =>
    exportTable(exportFor(view, rows, lastRefresh), format);

  const cards = [
    {
      icon: <HiOutlineCurrencyDollar className="text-[#45D483]" />,
      iconBgClass: "bg-icon-lightGreen",
      name: "Overall Shipper Receivable",
      value: formatMoney(d.receivable.CAD, Currency.CAD) ?? "—",
      caption: `+ ${formatMoney(d.receivable.USD, Currency.USD) ?? "—"} · ${formatMoney(d.receivableInCad, Currency.CAD) ?? "—"} in all, at invoice-date rates`,
    },
    {
      icon: <PiHandCoins className="text-base-primary-200" />,
      iconBgClass: "bg-icon-lightDarkBlue",
      name: "Overall Carrier Payable",
      value: formatMoney(d.payable.CAD, Currency.CAD) ?? "—",
      caption: `+ ${formatMoney(d.payable.USD, Currency.USD) ?? "—"} · ${formatMoney(d.payableInCad, Currency.CAD) ?? "—"} in all, at invoice-date rates`,
    },
    {
      icon: <PiArrowsClockwise className="text-[#BC8EF0]" />,
      iconBgClass: "bg-icon-lightPurple",
      name: "Last Balance Refresh",
      // Date only, so the value fits one line like the amounts beside it;
      // the time is in the caption.
      value: formatDate(lastRefresh) ?? "Not yet",
      caption: "Balances refresh daily at 06:00",
    },
    {
      icon: <PiCalendarDots className="text-[#F871A0]" />,
      iconBgClass: "bg-icon-lightRed",
      name: "Next Statement Emails",
      value: formatDate(nextWeeklyStatementRun) ?? "—",
      caption: `At 08:00 to ${weeklyShippers} shippers · month-end run ${formatDate(nextMonthEndStatementRun) ?? "—"}`,
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
      <AlertBanner message="Statements run on demo data until the Accounts API has payments and statements. Exports download these demo figures." />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((card) => (
          <StatCard key={card.name} card={card} />
        ))}
      </div>

      {canViewSide ? (
        <>
          <div className="flex flex-wrap justify-between items-end gap-3">
            <Tabs
              aria-label="Statements view"
              color="primary"
              variant="underlined"
              selectedKey={view}
              onSelectionChange={(key) => setView(key as View)}
              classNames={{ base: "max-w-full", cursor: "bg-base-primary" }}
            >
              {views.map((key) => (
                <Tab key={key} title={viewTitles[key]} />
              ))}
            </Tabs>
            <div className="flex gap-2">
              {can(Permission.ReportsExportCsv) && (
                <BaseButton
                  text="Excel"
                  varient="bordered"
                  className="text-base-primary rounded-xl px-3"
                  startContent={<PiFileXls className="text-lg" />}
                  onPress={() => runExport("Excel")}
                />
              )}
              {can(Permission.ReportsExportPdf) && (
                <BaseButton
                  text="PDF"
                  varient="bordered"
                  className="text-base-primary rounded-xl px-3"
                  startContent={<PiFilePdf className="text-lg" />}
                  onPress={() => runExport("PDF")}
                />
              )}
            </div>
          </div>

          <Card>
            <BaseTable<PartyAccountSummary>
              ariaLabel={view === "carriers" ? "Carrier statements" : "Shipper statements"}
              columns={columns}
              data={table.pageRows}
              rowKey={(row) => row.partyId}
              renderCell={renderCell}
              meta={table.meta}
              setMeta={table.setMeta}
              sort={table.sort}
              onSortChange={table.onSortChange}
              bottomContent={view === "carriers" ? "Carriers" : "Shippers"}
            />
          </Card>
        </>
      ) : (
        <Card className="p-4">
          <p className="text-sm text-gray-500">
            Your role can&apos;t view shipper or carrier invoices, so there are
            no statements to show.
          </p>
        </Card>
      )}

      {/* Only shippers are emailed statements, so the schedule belongs to
          their tab. */}
      {canViewSide && view === "shippers" && (
        <BaseCardWrapper
          heading="Statement Emails"
          action={
            can(Permission.ReportsSendEmail) && (
              <BaseButton
                text="Send statements now"
                className="rounded-xl px-4"
                startContent={<LuSend />}
                isDisabled={weeklyShippers === 0}
                onPress={() => setConfirmSend(true)}
              />
            )
          }
        >
          <p className="text-sm text-[#343A40] mb-4">
            Emailed at 08:00 (Toronto time) every Friday and on the last
            weekday of each month to the {weeklyShippers} shippers with
            statement emails on. Each covers the month to date and opens with
            the previous dues brought forward. Next Friday run{" "}
            <strong>{formatDateTime(nextWeeklyStatementRun)}</strong>; next
            month-end run <strong>{formatDateTime(nextMonthEndStatementRun)}</strong>.
          </p>
          <ul className="flex flex-col gap-2">
            {emailRuns.map((run) => (
              <li
                key={run.id}
                className="flex flex-wrap justify-between items-center gap-2 text-sm border-b border-gray-100 pb-2"
              >
                <span>
                  {formatDate(run.ranAt)} ·{" "}
                  {run.kind === StatementRunKind.MonthEndEmail ? "Month-end" : "Friday"} ·{" "}
                  {run.partyCount} shippers
                </span>
                <div className="flex gap-1">
                  <StatusChip text={`${run.sentCount ?? 0} sent`} tone="success" />
                  {!!run.failedCount && (
                    <StatusChip text={`${run.failedCount} failed`} tone="danger" />
                  )}
                </div>
              </li>
            ))}
          </ul>
        </BaseCardWrapper>
      )}

      {open && (
        <StatementModal summary={open} asOf={lastRefresh} onClose={() => setOpen(null)} />
      )}
      {confirmSend && (
        <SendStatementsModal
          shipperCount={weeklyShippers}
          onClose={() => setConfirmSend(false)}
        />
      )}
    </div>
  );
}

// Runs the statement email outside the schedule: the same month-to-date
// statement the Friday run sends, to the same shippers. The schedule itself
// doesn't change.
function SendStatementsModal({
  shipperCount,
  onClose,
}: {
  shipperCount: number;
  onClose: () => void;
}) {
  return (
    <FormModal
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title="Send Statements Now"
      confirmText="Send Now"
      onConfirm={() => {
        toast.info(
          `Statements to ${shipperCount} shippers — demo only, nothing was sent.`
        );
        onClose();
      }}
    >
      <p className="text-sm">
        Emails each of the {shipperCount} shippers with statement emails on
        their statement for the month to date, now instead of at the next
        scheduled run ({formatDateTime(nextWeeklyStatementRun) ?? "—"}).
      </p>
      <p className="text-sm text-[#707070]">
        The Friday and month-end runs still go out as scheduled. To send one
        shipper&apos;s statement, open it from the table and use Email
        statement.
      </p>
    </FormModal>
  );
}
