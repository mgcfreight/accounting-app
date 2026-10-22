import { Link, useSearchParams } from "react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  BaseButton,
  BaseCardWrapper,
  DetailRow,
  ErrorState,
  InfoStrip,
  InvoiceFlags,
  InvoiceStatusChip,
  Money,
  StatusChip,
} from "@/components/common";
import {
  ArrowRight,
  DocumentUpload,
  Pdf,
  Printer,
  Send,
} from "@/components/icons";
import { InvoiceDirection, InvoiceStatus } from "@/lib/enums";
import { findInvoice, findParty } from "@/lib/mock";
import { paymentMethodLabel } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/utils";
import InvoiceActionModal, { InvoiceAction } from "./invoice-action-modal";
import { availableActions } from "./invoice-row-actions";

const attachmentLabel = {
  MGC_INVOICE: "MGC invoice",
  BOL: "Bill of lading",
  POD: "Proof of delivery",
  OTHER: "Document",
};

const demoOnly = (what: string) =>
  toast.info(`${what} — demo only. Files and PDFs arrive with the API.`);

// mokal-app's InvoiceId page, extended with what the design adds to an
// invoice (§9): lines with tax, notes, payments, attachments and history.
export default function InvoiceDetail({
  direction,
}: {
  direction: InvoiceDirection;
}) {
  const [searchParams] = useSearchParams();
  const id = searchParams.get("id");
  const invoice = findInvoice(id);
  const [action, setAction] = useState<InvoiceAction | null>(null);
  const isReceivable = direction === InvoiceDirection.Receivable;
  const listHref = isReceivable ? "/shipper-invoices/" : "/carrier-invoices/";

  if (!invoice || invoice.direction !== direction) {
    return (
      <ErrorState
        title="Invoice not found"
        message={id ? `There is no invoice ${id}.` : "No invoice was chosen."}
      />
    );
  }

  const party = findParty(invoice.partyId);

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <Link to={listHref} className="text-base text-[#71717A]">
            {isReceivable ? "Shipper Invoices" : "Carrier Invoices"}
          </Link>
          <ArrowRight />
          <span className="text-base-primary-600 text-sm">#{invoice.number}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {availableActions(invoice).map((item) => (
            <BaseButton
              key={item.key}
              text={item.label}
              varient={item.key === "issue" ? "solid" : "bordered"}
              className={`rounded-xl px-4 ${
                item.key === "issue" ? "" : "text-base-primary"
              }`}
              startContent={item.key === "issue" ? <Send /> : undefined}
              onPress={() => setAction(item.key)}
            />
          ))}
          <BaseButton
            text="PDF"
            varient="bordered"
            className="rounded-xl px-4 text-base-primary"
            startContent={<Printer />}
            onPress={() => demoOnly("Invoice PDF")}
          />
        </div>
      </div>

      <InfoStrip
        items={[
          { label: "Invoice Date", value: formatDate(invoice.invoiceDate) },
          { label: "Due Date", value: formatDate(invoice.dueDate) },
          {
            label: "Invoice Total",
            value: <Money amount={invoice.total} currency={invoice.currency} />,
          },
          {
            label: "Balance",
            value:
              invoice.status === InvoiceStatus.Draft ? (
                "Not issued yet"
              ) : invoice.status === InvoiceStatus.Void ? (
                "Void — nothing owed"
              ) : (
                <Money
                  amount={invoice.balance}
                  currency={invoice.currency}
                  className="font-semibold"
                />
              ),
          },
          {
            label: "Status",
            value: (
              <div className="flex flex-wrap gap-1">
                <InvoiceStatusChip status={invoice.status} />
                <InvoiceFlags
                  overdueDays={invoice.overdueDays}
                  disputed={invoice.disputed}
                />
              </div>
            ),
          },
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <BaseCardWrapper heading={isReceivable ? "Bill To" : "Carrier"}>
          <div className="text-sm text-[#343A40] space-y-1">
            <p>
              <strong>Name:</strong>{" "}
              <Link
                to={`${isReceivable ? "/shippers" : "/carriers"}/view/?id=${invoice.partyId}`}
                className="text-base-primary-300 hover:underline"
              >
                {invoice.partyName}
              </Link>
            </p>
            {party && (
              <>
                <p>
                  <strong>Billing email:</strong> {party.billingEmails.join(", ")}
                </p>
                {party.ccEmails.length > 0 && (
                  <p>
                    <strong>CC:</strong> {party.ccEmails.join(", ")}
                  </p>
                )}
                <p>
                  <strong>Terms:</strong> Net {party.termsDays} days
                </p>
                <p>
                  <strong>GST/HST #:</strong> {party.gstHstNumber ?? "Not on file"}
                </p>
                <p>
                  <strong>Location:</strong> {party.address.city},{" "}
                  {party.address.province} {party.address.postalCode},{" "}
                  {party.address.country}
                </p>
              </>
            )}
          </div>
        </BaseCardWrapper>
        <BaseCardWrapper heading="Shipment">
          <div className="text-sm text-[#343A40] space-y-1">
            <p>
              <strong>Shipment:</strong> {invoice.shipmentId}
            </p>
            <p>
              <strong>From:</strong> {invoice.origin}
            </p>
            <p>
              <strong>To:</strong> {invoice.destination}
            </p>
            <p>
              <strong>Currency:</strong> {invoice.currency}
            </p>
            {!isReceivable && (
              <p>
                <strong>Carrier bill #:</strong>{" "}
                {invoice.carrierBillNo ?? "Awaiting bill"}
              </p>
            )}
          </div>
        </BaseCardWrapper>
      </div>

      <BaseCardWrapper heading="Charges">
        <div className="flex flex-col gap-4 mb-4 pb-4">
          {invoice.lines.map((line) => (
            <div key={line.id} className="flex flex-col gap-2">
              <DetailRow
                label={line.description}
                value={<Money amount={line.amount} currency={invoice.currency} />}
              />
              <DetailRow
                label={<span className="pl-4 text-content-5">{line.taxCode}</span>}
                value={
                  <Money amount={line.taxAmount} currency={invoice.currency} />
                }
              />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2 border-t-2 border-base-default pt-4">
          <DetailRow
            label="Subtotal"
            value={<Money amount={invoice.subtotal} currency={invoice.currency} />}
          />
          <DetailRow
            label={isReceivable ? "Tax" : "Tax (input tax credit)"}
            value={<Money amount={invoice.taxTotal} currency={invoice.currency} />}
          />
        </div>
        <div className="flex flex-col items-end gap-3 mt-6">
          <span className="font-medium text-sm">Invoice Total</span>
          <Money
            amount={invoice.total}
            currency={invoice.currency}
            className="font-medium text-xl"
          />
          <span className="text-sm opacity-70">Including tax</span>
        </div>
      </BaseCardWrapper>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <BaseCardWrapper heading="Credit & Debit Notes">
          {invoice.adjustments.length === 0 ? (
            <p className="text-sm text-content-5">No notes on this invoice.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {invoice.adjustments.map((note) => (
                <DetailRow
                  key={note.id}
                  label={`${note.number} · ${note.reason}`}
                  value={<Money amount={note.total} currency={invoice.currency} />}
                />
              ))}
            </div>
          )}
        </BaseCardWrapper>
        <BaseCardWrapper heading="Payments">
          {invoice.payments.length === 0 ? (
            <p className="text-sm text-content-5">No payments yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {invoice.payments.map((payment) => (
                <DetailRow
                  key={payment.id}
                  label={`${payment.paymentNumber} · ${paymentMethodLabel(payment.method)} · ${formatDate(payment.paidOn)}`}
                  value={
                    <Money amount={payment.amount} currency={invoice.currency} />
                  }
                />
              ))}
            </div>
          )}
        </BaseCardWrapper>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-5">
        <BaseCardWrapper
          heading="Documents"
          action={
            <BaseButton
              text="Upload"
              varient="light"
              className="text-base-primary"
              startContent={<DocumentUpload />}
              onPress={() => demoOnly("Upload")}
            />
          }
        >
          <div className="flex flex-col gap-3">
            {invoice.attachments.map((file) => (
              <div key={file.id} className="flex justify-between items-center gap-3">
                <span className="text-sm">{attachmentLabel[file.kind]}</span>
                <span className="flex-1 border-dotted border-b border-gray-300" />
                <button
                  type="button"
                  aria-label={`Download ${file.fileName}`}
                  onClick={() => demoOnly(file.fileName)}
                >
                  <Pdf />
                </button>
              </div>
            ))}
            {!invoice.attachments.some((file) => file.kind === "POD") && (
              <StatusChip text="No POD yet" tone="neutral" className="w-fit" />
            )}
          </div>
        </BaseCardWrapper>
        <BaseCardWrapper heading="History">
          <ol className="relative border-l-2 border-base-default ml-2 flex flex-col gap-4">
            {invoice.history.map((entry) => (
              <li key={entry.id} className="ml-4">
                <span className="absolute -left-1.75 mt-1 h-3 w-3 rounded-full bg-base-primary-300" />
                <p className="text-sm text-[#343A40]">{entry.action}</p>
                <p className="text-xs text-content-5">
                  {formatDateTime(entry.at)} · {entry.user}
                </p>
              </li>
            ))}
          </ol>
        </BaseCardWrapper>
      </div>

      <InvoiceActionModal
        action={action}
        invoice={invoice}
        onClose={() => setAction(null)}
      />
    </div>
  );
}
