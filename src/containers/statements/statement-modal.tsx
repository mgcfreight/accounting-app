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
import { InvoiceStatus, PartyType, Permission } from "@/lib/enums";
import { ExportTable } from "@/lib/export";
import { Invoice, PartyAccountSummary } from "@/lib/interfaces";
import {
  findStatements,
  mockCarrierInvoices,
  mockShipperInvoices,
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

// What a statement lists: invoices that were billed. Drafts weren't sent,
// void ones owe nothing, and a replaced version's balance moved to its new
// version.
const NOT_ON_STATEMENT = [
  InvoiceStatus.Draft,
  InvoiceStatus.Void,
  InvoiceStatus.Superseded,
];

const statementInvoices = (summary: PartyAccountSummary) =>
  (summary.type === PartyType.Shipper ? mockShipperInvoices : mockCarrierInvoices)
    .filter((invoice) => invoice.partyId === summary.partyId)
    .filter((invoice) => !NOT_ON_STATEMENT.includes(invoice.status));

const flagsText = (invoice: Invoice) =>
  [
    invoice.overdueDays > 0 ? `Overdue ${invoice.overdueDays}d` : "",
    invoice.disputed ? "Disputed" : "",
  ]
    .filter(Boolean)
    .join(", ");

// One party's statement: its billed invoices and the closing balance, as of
// the last daily refresh (`asOf`). Demo data until the API has statements.
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
  const history = findStatements(summary.partyId);
  const isShipper = summary.type === PartyType.Shipper;
  const closing = moneyText(summary.balance, summary.currency);

  const table: ExportTable<Invoice> = {
    title: `Statement - ${summary.partyName}`,
    subtitle: `As of ${formatDateTime(asOf) ?? "the last refresh"} · closing balance ${closing} · demo data`,
    columns: [
      { label: "Invoice #", value: (row) => row.number },
      { label: "Invoice date", value: (row) => formatDate(row.invoiceDate) ?? "" },
      { label: "Due date", value: (row) => formatDate(row.dueDate) ?? "" },
      { label: "Total", value: (row) => moneyText(row.total, row.currency) },
      { label: "Balance", value: (row) => moneyText(row.balance, row.currency) },
      { label: "Flags", value: flagsText },
    ],
    rows: invoices,
  };

  return (
    <FormModal
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title={`Statement: ${summary.partyName}`}
      size="5xl"
    >
      <div className="flex flex-wrap justify-between items-center gap-3">
        <p className="text-sm text-[#707070]">
          As of {formatDateTime(asOf) ?? "the last refresh"} · demo data
        </p>
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

      <BaseTable<Invoice>
        ariaLabel={`Statement for ${summary.partyName}`}
        columns={columns}
        data={invoices}
        rowKey={(row) => row.id}
        emptyContent="No billed invoices"
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
                  {statement.id} · {formatDate(statement.periodFrom)} –{" "}
                  {formatDate(statement.periodTo)} · sent{" "}
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
