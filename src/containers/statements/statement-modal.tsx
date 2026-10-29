import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PiFilePdf, PiFileXls } from "react-icons/pi";
import { toast } from "sonner";
import {
  BaseButton,
  BaseTable,
  DetailRow,
  ErrorState,
  FormModal,
  InvoiceFlags,
  Money,
  StatusChip,
} from "@/components/common";
import { useCan } from "@/components/providers/user-provider";
import { useFileDownload } from "@/hooks";
import {
  EmailStatus,
  PartyType,
  PaymentStatus,
  Permission,
  StatementEntryType,
} from "@/lib/enums";
import {
  PartyAccountSummary,
  PartyStatement,
  StatementInvoice,
  StatementLine,
} from "@/lib/interfaces";
import { BaseTableColumn } from "@/lib/types";
import { formatDate, formatDateTime } from "@/lib/utils";
import {
  downloadStatement,
  emailStatement,
  errorMessage,
  getCurrentStatement,
  getStatement,
  listStatementHistory,
  sendLatestDues,
  StatementFormat,
} from "@/services";

const entryTypeLabels: Record<StatementEntryType, string> = {
  [StatementEntryType.Invoice]: "Invoice",
  [StatementEntryType.Adjustment]: "Adjustment",
  [StatementEntryType.CreditNote]: "Credit note",
  [StatementEntryType.Payment]: "Payment",
  [StatementEntryType.WriteOff]: "Write-off",
};

const emailStatusChip: Record<EmailStatus, { text: string; tone: "success" | "warning" | "danger" }> = {
  [EmailStatus.Sent]: { text: "Emailed", tone: "success" },
  [EmailStatus.Queued]: { text: "Saved, not emailed", tone: "warning" },
  [EmailStatus.Failed]: { text: "Email failed", tone: "danger" },
  [EmailStatus.Bounced]: { text: "Email bounced", tone: "danger" },
};

const invoiceColumns: BaseTableColumn[] = [
  { key: "number", label: "Invoice #" },
  { key: "invoiceDate", label: "Invoice Date" },
  { key: "dueDate", label: "Due Date" },
  { key: "total", label: "Total", align: "end" },
  { key: "balance", label: "Balance", align: "end" },
  { key: "status", label: "Status" },
];

const lineColumns: BaseTableColumn[] = [
  { key: "entryDate", label: "Date" },
  { key: "entry", label: "Entry" },
  { key: "debit", label: "Charges", align: "end" },
  { key: "credit", label: "Payments & Credits", align: "end" },
  { key: "runningBalance", label: "Balance", align: "end" },
];

const HISTORY_LIMIT = 10;

// The toast for "Email statement" and "Send latest dues": a statement is
// saved either way, so say what happened to the email.
const emailOutcome = (statement: PartyStatement, what: string) => {
  const to = statement.sentTo?.join(", ");
  switch (statement.emailStatus) {
    case EmailStatus.Sent:
      return toast.success(`${statement.number} ${what} emailed${to ? ` to ${to}` : ""}.`);
    case EmailStatus.Queued:
      return toast.warning(`${statement.number} saved; email is switched off, so it was not sent.`);
    default:
      return toast.error(`${statement.number} saved, but the email failed. Try again later.`);
  }
};

function StatementInvoices({ statement }: { statement: PartyStatement }) {
  return (
    <BaseTable<StatementInvoice>
      ariaLabel={`Invoices on the statement for ${statement.partyName}`}
      columns={invoiceColumns}
      data={statement.invoices}
      rowKey={(row) => `${row.entryType}-${row.id}`}
      emptyContent="No invoices on this statement"
      renderCell={(row, key) => {
        switch (key) {
          case "number":
            return (
              <div className="flex flex-col">
                <span className="font-bold">{row.number ?? "No number yet"}</span>
                {row.entryType !== StatementEntryType.Invoice && (
                  <span className="text-gray-500">{entryTypeLabels[row.entryType]}</span>
                )}
              </div>
            );
          case "invoiceDate":
            return <span className="whitespace-nowrap">{formatDate(row.invoiceDate)}</span>;
          case "dueDate":
            return row.dueDate ? (
              <span className="whitespace-nowrap">{formatDate(row.dueDate)}</span>
            ) : (
              <span className="text-gray-400">—</span>
            );
          case "total":
            return <Money amount={row.total} currency={row.currency} />;
          case "balance":
            return <Money amount={row.balance} currency={row.currency} className="font-semibold" />;
          case "status":
            return (
              <div className="flex flex-col items-start gap-1">
                {row.paymentStatus === PaymentStatus.Paid ? (
                  <StatusChip text="Paid" tone="success" />
                ) : row.paymentStatus === PaymentStatus.Unpaid ? (
                  <StatusChip text="Unpaid" tone="warning" />
                ) : null}
                {row.previousDue && <StatusChip text="Previous due" tone="neutral" />}
                <InvoiceFlags overdueDays={row.overdueDays} disputed={false} />
              </div>
            );
          default:
            return null;
        }
      }}
    />
  );
}

function StatementActivity({ statement }: { statement: PartyStatement }) {
  const { currency } = statement;
  return (
    <BaseTable<StatementLine>
      ariaLabel={`Activity on the statement for ${statement.partyName}`}
      columns={lineColumns}
      data={statement.lines}
      rowKey={(row) => `${row.entryType}-${row.sourceId}-${row.entryDate}`}
      emptyContent="No activity in this period"
      renderCell={(row, key) => {
        switch (key) {
          case "entryDate":
            return <span className="whitespace-nowrap">{formatDate(row.entryDate)}</span>;
          case "entry":
            return (
              <div className="flex flex-col">
                <span className="font-semibold">
                  {entryTypeLabels[row.entryType]} {row.reference ?? row.paymentReference ?? ""}
                </span>
                {row.loadNumber && <span className="text-gray-500">Load {row.loadNumber}</span>}
                {row.previousDue && <span className="text-gray-500">Previous due</span>}
              </div>
            );
          case "debit":
            return <Money amount={row.debit} currency={currency} />;
          case "credit":
            return <Money amount={row.credit} currency={currency} />;
          case "runningBalance":
            return <Money amount={row.runningBalance} currency={currency} className="font-semibold" />;
          default:
            return null;
        }
      }}
    />
  );
}

function StatementFigures({ statement }: { statement: PartyStatement }) {
  const { currency, overdue } = statement;
  const amount = (value: string, bold = false) => (
    <Money amount={value} currency={currency} className={bold ? "font-semibold" : undefined} />
  );
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 border-t-2 border-base-default pt-4">
      <div className="flex flex-col gap-2">
        <DetailRow label="Opening balance" value={amount(statement.openingBalance)} />
        <DetailRow label="Invoiced in the period" value={amount(statement.invoiced)} />
        <DetailRow label="Paid and credited" value={amount(statement.paidAndCredited)} />
        <DetailRow label="Closing balance" value={amount(statement.closingBalance, true)} />
        <DetailRow label="Of which previous dues" value={amount(statement.previousDues)} />
      </div>
      <div className="flex flex-col gap-2">
        <DetailRow label="Overdue 1–30 days" value={amount(overdue.days1to30)} />
        <DetailRow label="Overdue 31–60 days" value={amount(overdue.days31to60)} />
        <DetailRow label="Overdue 61–90 days" value={amount(overdue.days61to90)} />
        <DetailRow label="Overdue 90+ days" value={amount(overdue.days90plus)} />
      </div>
    </div>
  );
}

// One party's statement: the current one for the 7 days to today, worked
// out live and not saved, or one of its saved statements. Shippers can be
// emailed theirs, or sent their latest billing-period dues.
export default function StatementModal({
  summary,
  onClose,
}: {
  summary: PartyAccountSummary;
  onClose: () => void;
}) {
  const { can } = useCan();
  const { partyId, partyName } = summary;
  const isShipper = summary.type === PartyType.Shipper;
  const canEmail = isShipper && !!summary.statementEmail && can(Permission.ReportsSendEmail);
  // Null: the current statement.
  const [statementId, setStatementId] = useState<string | null>(null);
  const [historyPage, setHistoryPage] = useState(1);

  const current = useQuery({
    queryKey: ["statements", "current", partyId],
    queryFn: ({ signal }) => getCurrentStatement(partyId, signal),
    enabled: statementId === null,
  });
  const saved = useQuery({
    queryKey: ["statements", "detail", statementId],
    queryFn: ({ signal }) => getStatement(statementId!, signal),
    enabled: statementId !== null,
  });
  const shown = statementId === null ? current : saved;
  const statement = shown.data;

  const historyParams = { partyId, page: historyPage, limit: HISTORY_LIMIT };
  const history = useQuery({
    queryKey: ["statements", "history", historyParams],
    queryFn: ({ signal }) => listStatementHistory(historyParams, signal),
    placeholderData: keepPreviousData,
  });

  const queryClient = useQueryClient();
  const sendMutation = (send: (partyId: string) => Promise<PartyStatement>, what: string) => ({
    mutationFn: () => send(partyId),
    onSuccess: (sent: PartyStatement) => {
      emailOutcome(sent, what);
      setHistoryPage(1);
      void queryClient.invalidateQueries({ queryKey: ["statements"] });
    },
    onError: (error: Error) => toast.error(errorMessage(error)),
  });
  const email = useMutation(sendMutation(emailStatement, "statement"));
  const dues = useMutation(sendMutation(sendLatestDues, "dues report"));

  const download = useFileDownload((format: StatementFormat) =>
    statementId === null
      ? downloadStatement(
          { partyId },
          format,
          `Statement ${partyName} ${statement?.periodTo ?? "current"}.${format}`
        )
      : downloadStatement({ statementId }, format, `${statement?.number ?? "Statement"}.${format}`)
  );
  const downloading = (format: StatementFormat) =>
    download.isPending && download.variables === format;
  const status = statement?.emailStatus ? emailStatusChip[statement.emailStatus] : null;

  return (
    <FormModal
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title={`Statement: ${partyName}`}
      size="5xl"
    >
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm text-[#707070]">
          {statement ? (
            <>
              <span className="font-semibold text-[#343A40]">
                {statement.number ?? "Current statement, not saved"}
              </span>
              <span>
                {formatDate(statement.periodFrom)} – {formatDate(statement.periodTo)} · as
                of {formatDateTime(statement.asOf)}
              </span>
              {status && <StatusChip text={status.text} tone={status.tone} />}
            </>
          ) : (
            <span>Loading the statement…</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {statementId !== null && (
            <BaseButton
              text="Back to current"
              varient="bordered"
              className="text-base-primary rounded-xl px-3"
              onPress={() => setStatementId(null)}
            />
          )}
          {can(Permission.ReportsExportPdf) && (
            <BaseButton
              text="PDF"
              varient="bordered"
              className="text-base-primary rounded-xl px-3"
              startContent={<PiFilePdf className="text-lg" />}
              isDisabled={!statement}
              isLoading={downloading("pdf")}
              onPress={() => download.mutate("pdf")}
            />
          )}
          {can(Permission.ReportsExportCsv) && (
            <BaseButton
              text="Excel"
              varient="bordered"
              className="text-base-primary rounded-xl px-3"
              startContent={<PiFileXls className="text-lg" />}
              isDisabled={!statement}
              isLoading={downloading("xlsx")}
              onPress={() => download.mutate("xlsx")}
            />
          )}
          {canEmail && (
            <>
              <BaseButton
                text="Send latest dues"
                varient="bordered"
                className="text-base-primary rounded-xl px-3"
                isLoading={dues.isPending}
                isDisabled={email.isPending}
                onPress={() => dues.mutate()}
              />
              <BaseButton
                text="Email statement"
                className="rounded-xl px-3"
                isLoading={email.isPending}
                isDisabled={dues.isPending}
                onPress={() => email.mutate()}
              />
            </>
          )}
        </div>
      </div>
      {statement?.sentTo && statement.sentTo.length > 0 && (
        <p className="text-sm text-[#707070]">To {statement.sentTo.join(", ")}</p>
      )}

      {shown.isError ? (
        <ErrorState
          message="We couldn't load this statement. Please try again."
          onAction={() => void shown.refetch()}
        />
      ) : statement ? (
        <>
          <StatementInvoices statement={statement} />
          <StatementFigures statement={statement} />
          <div className="flex flex-col gap-2">
            <h3 className="text-base-primary font-semibold">Activity</h3>
            <StatementActivity statement={statement} />
          </div>
        </>
      ) : null}

      <div className="flex flex-col gap-2">
        <h3 className="text-base-primary font-semibold">Saved statements</h3>
        {history.isError ? (
          <ErrorState
            message="We couldn't load the saved statements. Please try again."
            onAction={() => void history.refetch()}
          />
        ) : history.data?.items.length === 0 ? (
          <p className="text-sm text-gray-500">None yet.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm text-[#343A40]">
            {history.data?.items.map((item) => {
              const chip = item.emailStatus ? emailStatusChip[item.emailStatus] : null;
              return (
                <li
                  key={item.statementId}
                  className="flex flex-wrap justify-between items-center gap-2 border-b border-gray-100 pb-1"
                >
                  <button
                    type="button"
                    className={`text-left hover:underline ${
                      item.statementId === statementId ? "font-semibold text-base-primary" : ""
                    }`}
                    onClick={() => setStatementId(item.statementId)}
                  >
                    {item.id} · {formatDate(item.periodFrom)} – {formatDate(item.periodTo)} ·{" "}
                    {formatDateTime(item.sentAt)}
                  </button>
                  <div className="flex items-center gap-2">
                    {chip && <StatusChip text={chip.text} tone={chip.tone} />}
                    <Money amount={item.closingBalance} currency={item.currency} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {history.data && history.data.meta.totalPages > 1 && (
          <div className="flex items-center gap-2 text-sm">
            <BaseButton
              text="Newer"
              varient="bordered"
              className="text-base-primary rounded-xl px-3"
              isDisabled={historyPage <= 1}
              onPress={() => setHistoryPage((page) => page - 1)}
            />
            <span>
              Page {historyPage} of {history.data.meta.totalPages}
            </span>
            <BaseButton
              text="Older"
              varient="bordered"
              className="text-base-primary rounded-xl px-3"
              isDisabled={historyPage >= history.data.meta.totalPages}
              onPress={() => setHistoryPage((page) => page + 1)}
            />
          </div>
        )}
      </div>
    </FormModal>
  );
}
