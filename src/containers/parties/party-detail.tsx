import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";
import {
  BaseButton,
  BaseCardWrapper,
  BaseTable,
  ErrorState,
  InfoStrip,
  Money,
} from "@/components/common";
import { ArrowRight, Pdf, Send } from "@/components/icons";
import { useCan } from "@/components/providers/user-provider";
import { InvoiceStatus, PartyType, Permission } from "@/lib/enums";
import {
  findParty,
  findStatements,
  mockCarrierInvoices,
  mockShipperInvoices,
} from "@/lib/mock";
import { BaseTableColumn } from "@/lib/types";
import { formatDate, formatDateTime } from "@/lib/utils";
import InvoiceCell from "../invoices/invoice-cell";

const invoiceColumns: BaseTableColumn[] = [
  { key: "number", label: "Invoice #" },
  { key: "lane", label: "Lane" },
  { key: "dueDate", label: "Due Date" },
  { key: "total", label: "Total" },
  { key: "balance", label: "Balance" },
  { key: "status", label: "Status" },
];

// A shipper's or carrier's balance page (design §3 "Per-carrier breakdown"):
// profile, balance, overdue, last payment, open invoices and statements.
export default function PartyDetail({ type }: { type: PartyType }) {
  const [searchParams] = useSearchParams();
  const id = searchParams.get("id");
  const party = findParty(id);
  const { can } = useCan();
  const isShipper = type === PartyType.Shipper;
  const listHref = isShipper ? "/shippers/" : "/carriers/";

  if (!party || party.type !== type) {
    return (
      <ErrorState
        title={`${isShipper ? "Shipper" : "Carrier"} not found`}
        message={id ? `There is no record ${id}.` : "None was chosen."}
      />
    );
  }

  const invoices = (isShipper ? mockShipperInvoices : mockCarrierInvoices).filter(
    (invoice) => invoice.partyId === party.id && invoice.status !== InvoiceStatus.Void
  );
  const statements = findStatements(party.id);

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <Link to={listHref} className="text-base text-[#71717A]">
            {isShipper ? "Shippers" : "Carriers"}
          </Link>
          <ArrowRight />
          <span className="text-base-primary-600 text-sm">{party.name}</span>
        </div>
        {/* Statements belong to reports on the API (reports.send_email). */}
        {can(Permission.ReportsSendEmail) && (
          <BaseButton
            text="Send Statement Now"
            className="rounded-xl px-4"
            startContent={<Send />}
            onPress={() =>
              toast.info(`Statement to ${party.name} — demo only, nothing was sent.`)
            }
          />
        )}
      </div>

      <InfoStrip
        items={[
          {
            label: "Balance",
            value: <Money amount={party.balance} currency={party.currency} className="font-semibold" />,
          },
          {
            label: "Overdue",
            value: <Money amount={party.overdue} currency={party.currency} />,
          },
          { label: "Shipments", value: party.shipmentCount },
          {
            label: "Last Payment",
            value: party.lastPaymentOn ? formatDate(party.lastPaymentOn) : "None yet",
          },
          { label: "Terms", value: `Net ${party.termsDays} days` },
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <BaseCardWrapper heading="Profile">
          <div className="text-sm text-[#343A40] space-y-1">
            <p>
              <strong>MGC id:</strong> {party.id}
            </p>
            <p>
              <strong>Default currency:</strong> {party.currency}
            </p>
            <p>
              <strong>GST/HST #:</strong> {party.gstHstNumber ?? "Not on file"}
            </p>
            <p>
              <strong>Location:</strong> {party.address.city}, {party.address.province}{" "}
              {party.address.postalCode}, {party.address.country}
            </p>
          </div>
        </BaseCardWrapper>
        <BaseCardWrapper heading="Billing Contacts">
          <div className="text-sm text-[#343A40] space-y-1">
            <p>
              <strong>To:</strong> {party.billingEmails.join(", ")}
            </p>
            <p>
              <strong>CC:</strong>{" "}
              {party.ccEmails.length > 0 ? party.ccEmails.join(", ") : "None"}
            </p>
            <p className="text-xs text-content-5 pt-2">
              {isShipper
                ? "Invoices, reminders and Friday statements go to these addresses."
                : "Carrier reminders go to MGC's accounts team, not the carrier."}
            </p>
          </div>
        </BaseCardWrapper>
      </div>

      <BaseCardWrapper heading="Invoices">
        <BaseTable
          ariaLabel="Invoices"
          columns={invoiceColumns}
          data={invoices}
          rowKey={(row) => row.id}
          renderCell={(row, key) => <InvoiceCell invoice={row} columnKey={key} />}
          emptyContent="No invoices"
        />
      </BaseCardWrapper>

      <BaseCardWrapper heading="Statement History" className="mb-5">
        {statements.length === 0 ? (
          <p className="text-sm text-content-5">No statements sent yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {statements.map((statement) => (
              // On a phone the period takes its own line, with the sent time,
              // balance and download below it.
              <div
                key={statement.id}
                className="flex flex-wrap sm:flex-nowrap justify-between items-center gap-x-3 gap-y-1 text-sm"
              >
                <span className="w-full sm:w-auto">
                  {statement.id} · {formatDate(statement.periodFrom)} –{" "}
                  {formatDate(statement.periodTo)}
                </span>
                <span className="hidden sm:block flex-1 border-dotted border-b border-gray-300" />
                <span className="text-xs text-content-5 mr-auto sm:mr-0">
                  Sent {formatDateTime(statement.sentAt)}
                </span>
                <Money amount={statement.closingBalance} currency={party.currency} />
                {can(Permission.ReportsExportPdf) && (
                  <button
                    type="button"
                    aria-label={`Download ${statement.id}`}
                    onClick={() => toast.info("Statement PDF — demo only.")}
                  >
                    <Pdf />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </BaseCardWrapper>
    </div>
  );
}
