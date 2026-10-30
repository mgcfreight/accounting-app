import { PiFilePdf, PiFileXls } from "react-icons/pi";
import { toast } from "sonner";
import {
  BaseButton,
  BaseTable,
  DetailRow,
  FormModal,
  InvoiceFlags,
  InvoiceStatusChip,
  Money,
} from "@/components/common";
import { useCan } from "@/components/providers/user-provider";
import {
  Currency,
  InvoiceStatus,
  PartyType,
  Permission,
  StatementRunKind,
} from "@/lib/enums";
import { ExportTable } from "@/lib/export";
import { Invoice, PartyAccountSummary, Payment } from "@/lib/interfaces";
import {
  findStatements,
  mockCarrierInvoices,
  mockPayments,
  mockShipperInvoices,
  statementPeriodFrom,
} from "@/lib/mock";
import { BaseTableColumn } from "@/lib/types";
import { formatDate, formatDateTime } from "@/lib/utils";
import { exportTable, moneyText } from "../reports/export-table";

const columns: BaseTableColumn[] = [
  { key: "number", label: "Invoice #" },
  { key: "invoiceDate", label: "Invoice Date" },
  { key: "dueDate", label: "Due Date" },
  { key: "total", label: "Total", align: "end" },
  { key: "balance", label: "Balance", align: "end" },
  { key: "status", label: "Status" },
];

const paymentColumns: BaseTableColumn[] = [
  { key: "number", label: "Payment #" },
  { key: "paidOn", label: "Paid On" },
  { key: "amount", label: "Amount", align: "end" },
  { key: "appliedTo", label: "Applied To" },
];

// What a statement lists: invoices that were billed. Drafts weren't sent,
// void ones owe nothing, and a replaced version's balance moved to its new
// version.
const NOT_ON_STATEMENT = [
  InvoiceStatus.Draft,
  InvoiceStatus.Void,
  InvoiceStatus.Superseded,
];

// The period runs from the 1st of the month; anything older is in the
// opening balance (previous dues). Dates are ISO calendar dates, so they
// compare as strings.
const statementInvoices = (summary: PartyAccountSummary) =>
  (summary.type === PartyType.Shipper ? mockShipperInvoices : mockCarrierInvoices)
    .filter((invoice) => invoice.partyId === summary.partyId)
    .filter((invoice) => !NOT_ON_STATEMENT.includes(invoice.status))
    .filter((invoice) => invoice.invoiceDate >= statementPeriodFrom);

const statementPayments = (summary: PartyAccountSummary) =>
  mockPayments
    .filter((payment) => payment.partyId === summary.partyId)
    .filter((payment) => payment.paidOn >= statementPeriodFrom);

// A payment counts against the balance once it is allocated to invoices.
const appliedToText = (payment: Payment) =>
  payment.allocations.length
    ? payment.allocations.map((allocation) => allocation.invoiceNumber).join(", ")
    : "Not allocated yet, so not in the balance";

const flagsText = (invoice: Invoice) =>
  [
    invoice.overdueDays > 0 ? `Overdue ${invoice.overdueDays}d` : "",
    invoice.disputed ? "Disputed" : "",
  ]
    .filter(Boolean)
    .join(", ");

// One line of the exported statement: an invoice billed or a payment made
// in the period.
type StatementLine = {
  id: string;
  date: string;
  reference: string;
  detail: string;
  amount: string;
  balance: string | null;
  currency: Currency;
};

const invoiceLine = (invoice: Invoice): StatementLine => ({
  id: invoice.id,
  date: invoice.invoiceDate,
  reference: invoice.number,
  detail: [`Invoice, due ${formatDate(invoice.dueDate) ?? ""}`, flagsText(invoice)]
    .filter(Boolean)
    .join(", "),
  amount: invoice.total,
  balance: invoice.balance,
  currency: invoice.currency,
});

const paymentLine = (payment: Payment): StatementLine => ({
  id: payment.id,
  date: payment.paidOn,
  reference: payment.number,
  detail: `Payment, applied to: ${appliedToText(payment)}`,
  amount: payment.amount,
  balance: null,
  currency: payment.currency,
});

// One party's statement for the month to date, as of the last daily refresh
// (`asOf`): previous dues brought forward, the invoices and payments in the
// period, and the closing balance. Demo data until the API has statements.
export default function StatementModal({
  summary,
  asOf,
  onClose,
}: {
  summary: PartyAccountSummary;
  asOf: string | undefined;
  onClose: () => void;
}) {
  const { can } = useCan();
  const invoices = statementInvoices(summary);
  const payments = statementPayments(summary);
  const history = findStatements(summary.partyId);
  const isShipper = summary.type === PartyType.Shipper;
  const opening = moneyText(summary.openingBalance, summary.currency);
  const closing = moneyText(summary.balance, summary.currency);
  const periodText = `${formatDate(statementPeriodFrom) ?? ""} to ${formatDateTime(asOf) ?? "the last refresh"}`;

  const table: ExportTable<StatementLine> = {
    title: `Statement - ${summary.partyName}`,
    subtitle: `${periodText} · previous dues ${opening} · closing balance ${closing} · demo data`,
    columns: [
      { label: "Date", value: (row) => formatDate(row.date) ?? "" },
      { label: "Reference", value: (row) => row.reference },
      { label: "Detail", value: (row) => row.detail },
      { label: "Amount", value: (row) => moneyText(row.amount, row.currency) },
      {
        label: "Invoice balance",
        value: (row) => (row.balance === null ? "" : moneyText(row.balance, row.currency)),
      },
    ],
    rows: [...invoices.map(invoiceLine), ...payments.map(paymentLine)].sort((a, b) =>
      a.date.localeCompare(b.date)
    ),
  };

  return (
    <FormModal
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title={`Statement: ${summary.partyName}`}
      size="5xl"
    >
      <div className="flex flex-wrap justify-between items-center gap-3">
        <p className="text-sm text-[#707070]">{periodText} · demo data</p>
        <div className="flex flex-wrap gap-2">
          {can(Permission.ReportsExportPdf) && (
            <BaseButton
              text="PDF"
              varient="bordered"
              className="text-base-primary rounded-xl px-3"
              startContent={<PiFilePdf className="text-lg" />}
              onPress={() => exportTable(table, "PDF")}
            />
          )}
          {can(Permission.ReportsExportCsv) && (
            <BaseButton
              text="Excel"
              varient="bordered"
              className="text-base-primary rounded-xl px-3"
              startContent={<PiFileXls className="text-lg" />}
              onPress={() => exportTable(table, "Excel")}
            />
          )}
          {isShipper && summary.statementEmail && can(Permission.ReportsSendEmail) && (
            <BaseButton
              text="Email statement"
              className="rounded-xl px-3"
              onPress={() =>
                toast.info(
                  `Statement to ${summary.statementEmail} — demo only, nothing was sent.`
                )
              }
            />
          )}
        </div>
      </div>

      <DetailRow
        label="Previous dues (opening balance)"
        value={<Money amount={summary.openingBalance} currency={summary.currency} className="font-semibold" />}
      />

      <BaseTable<Invoice>
        ariaLabel={`Invoices on the statement for ${summary.partyName}`}
        columns={columns}
        data={invoices}
        rowKey={(row) => row.id}
        emptyContent="No invoices billed this period"
        renderCell={(row, key) => {
          switch (key) {
            case "number":
              return <span className="font-bold">{row.number}</span>;
            case "invoiceDate":
              return <span className="whitespace-nowrap">{formatDate(row.invoiceDate)}</span>;
            case "dueDate":
              return <span className="whitespace-nowrap">{formatDate(row.dueDate)}</span>;
            case "total":
              return <Money amount={row.total} currency={row.currency} />;
            case "balance":
              return <Money amount={row.balance} currency={row.currency} className="font-semibold" />;
            case "status":
              return (
                <div className="flex flex-col items-start gap-1">
                  <InvoiceStatusChip status={row.status} />
                  <InvoiceFlags overdueDays={row.overdueDays} disputed={row.disputed} />
                </div>
              );
            default:
              return null;
          }
        }}
      />

      {payments.length > 0 && (
        <BaseTable<Payment>
          ariaLabel={`Payments on the statement for ${summary.partyName}`}
          columns={paymentColumns}
          data={payments}
          rowKey={(row) => row.id}
          renderCell={(row, key) => {
            switch (key) {
              case "number":
                return <span className="font-bold">{row.number}</span>;
              case "paidOn":
                return <span className="whitespace-nowrap">{formatDate(row.paidOn)}</span>;
              case "amount":
                return <Money amount={row.amount} currency={row.currency} />;
              case "appliedTo":
                return row.allocations.length ? (
                  appliedToText(row)
                ) : (
                  <span className="text-gray-500">{appliedToText(row)}</span>
                );
              default:
                return null;
            }
          }}
        />
      )}

      <div className="flex flex-col gap-2 border-t-2 border-base-default pt-4">
        <DetailRow
          label="Closing balance"
          value={<Money amount={summary.balance} currency={summary.currency} className="font-semibold" />}
        />
        <DetailRow
          label="Of which overdue"
          value={<Money amount={summary.overdue} currency={summary.currency} />}
        />
      </div>

      {history.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-base-primary font-semibold">Statements sent</h3>
          <ul className="flex flex-col gap-1 text-sm text-[#343A40]">
            {history.map((statement) => (
              <li key={statement.id} className="flex flex-wrap justify-between gap-2">
                <span>
                  {statement.id} ·{" "}
                  {statement.kind === StatementRunKind.MonthEndEmail ? "Month-end" : "Friday"} ·{" "}
                  {formatDate(statement.periodFrom)} – {formatDate(statement.periodTo)} · sent{" "}
                  {formatDateTime(statement.sentAt)}
                </span>
                <Money amount={statement.closingBalance} currency={summary.currency} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </FormModal>
  );
}
