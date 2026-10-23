import { Link } from "react-router";
import {
  CarrierInvoiceStatusChip,
  CustomerInvoiceStatusChip,
  Money,
  PartyAvatar,
  PaymentStatusChip,
  StatusChip,
} from "@/components/common";
import {
  CarrierInvoiceStatus,
  CustomerInvoiceStatus,
  InvoiceDirection,
} from "@/lib/enums";
import {
  CarrierInvoiceView,
  CustomerInvoiceView,
  ReferenceNumbers,
} from "@/lib/interfaces";
import { formatDate } from "@/lib/utils";

// Helpers and one renderCell for invoices from the Accounts API, used by the
// invoice lists, the invoice page and the party pages. (invoice-cell.tsx is
// the mock-data version, still used by the dashboard.)

export type InvoiceView = CustomerInvoiceView | CarrierInvoiceView;

export const isCustomerInvoice = (
  invoice: InvoiceView
): invoice is CustomerInvoiceView => "customerId" in invoice;

export const directionOf = (invoice: InvoiceView) =>
  isCustomerInvoice(invoice)
    ? InvoiceDirection.Receivable
    : InvoiceDirection.Payable;

export const invoiceListHref = (direction: InvoiceDirection) =>
  direction === InvoiceDirection.Receivable
    ? "/shipper-invoices/"
    : "/carrier-invoices/";

export const apiInvoiceHref = (invoice: InvoiceView) =>
  `${invoiceListHref(directionOf(invoice))}view/?id=${encodeURIComponent(invoice.id)}`;

// A customer invoice is numbered once it has its TMS code; a carrier
// invoice by MGC's reference number.
export const invoiceNumberOf = (invoice: InvoiceView): string | null =>
  isCustomerInvoice(invoice) ? invoice.invoiceNumber : invoice.referenceNumber;

export const partyOf = (invoice: InvoiceView) =>
  isCustomerInvoice(invoice)
    ? {
        id: invoice.customerId,
        name: invoice.customerName,
        href: `/shippers/view/?id=${encodeURIComponent(invoice.customerId)}`,
      }
    : {
        id: invoice.carrierId,
        name: invoice.carrierName,
        href: `/carriers/view/?id=${encodeURIComponent(invoice.carrierId)}`,
      };

export const referenceLabels: Record<keyof ReferenceNumbers, string> = {
  bolNumber: "BOL",
  pickupNumber: "Pickup",
  poNumber: "PO",
  soNumber: "SO",
  proNumber: "PRO",
  quoteNumber: "Quote",
  billNumber: "Bill",
};

// The reference numbers an invoice has, in a fixed order.
export const referencesOf = (invoice: ReferenceNumbers) =>
  (Object.keys(referenceLabels) as (keyof ReferenceNumbers)[])
    .filter((key) => invoice[key])
    .map((key) => ({ key, label: referenceLabels[key], value: invoice[key]! }));

// A draft customer invoice owes nothing yet, and an expected carrier invoice
// owes 0 until its bill arrives: "0.00" beside either reads as "paid".
export const owesNothingYet = (invoice: InvoiceView) =>
  isCustomerInvoice(invoice)
    ? invoice.status === CustomerInvoiceStatus.Draft
    : invoice.status === CarrierInvoiceStatus.Expected;

const isVoid = (invoice: InvoiceView) =>
  invoice.status === CustomerInvoiceStatus.Void ||
  invoice.status === CarrierInvoiceStatus.Void;

// Review flags matter until the invoice goes out or is approved.
export const awaitsReview = (invoice: InvoiceView) =>
  invoice.reviewFlags.length > 0 &&
  (isCustomerInvoice(invoice)
    ? invoice.status === CustomerInvoiceStatus.Draft
    : invoice.status !== CarrierInvoiceStatus.Approved &&
      invoice.status !== CarrierInvoiceStatus.Void);

export function InvoiceStatusCell({ invoice }: { invoice: InvoiceView }) {
  return (
    <div className="flex flex-wrap items-start gap-1">
      {isCustomerInvoice(invoice) ? (
        <CustomerInvoiceStatusChip status={invoice.status} />
      ) : (
        <CarrierInvoiceStatusChip status={invoice.status} />
      )}
      {!owesNothingYet(invoice) && !isVoid(invoice) && (
        <PaymentStatusChip
          status={invoice.paymentStatus}
          amountPaid={invoice.amountPaid}
        />
      )}
      {awaitsReview(invoice) && <StatusChip text="Needs review" tone="warning" />}
    </div>
  );
}

export function InvoiceBalance({
  invoice,
  className = "font-semibold",
}: {
  invoice: InvoiceView;
  className?: string;
}) {
  if (isVoid(invoice)) return <span className="text-gray-400">—</span>;
  if (owesNothingYet(invoice)) {
    return (
      <span className="text-gray-400">
        {isCustomerInvoice(invoice) ? "Not issued" : "Awaiting bill"}
      </span>
    );
  }
  return (
    <Money
      amount={invoice.balanceDue}
      currency={invoice.currency}
      className={className}
    />
  );
}

// An expected carrier invoice's total is 0 until the bill arrives; what it
// is expected to be is shown instead, marked as such.
export function InvoiceTotal({ invoice }: { invoice: InvoiceView }) {
  if (
    !isCustomerInvoice(invoice) &&
    invoice.status === CarrierInvoiceStatus.Expected
  ) {
    return (
      <span className="text-gray-500 whitespace-nowrap">
        Expected <Money amount={invoice.expectedTotal} currency={invoice.currency} />
      </span>
    );
  }
  return <Money amount={invoice.total} currency={invoice.currency} />;
}

export default function InvoiceViewCell({
  invoice,
  columnKey,
}: {
  invoice: InvoiceView;
  columnKey: string;
}) {
  switch (columnKey) {
    case "number": {
      const number = invoiceNumberOf(invoice);
      return (
        <Link
          to={apiInvoiceHref(invoice)}
          className={`hover:underline whitespace-nowrap ${
            number ? "font-bold text-base-primary-300" : "text-gray-500"
          }`}
        >
          {number ?? "No number yet"}
        </Link>
      );
    }
    case "party": {
      const party = partyOf(invoice);
      return (
        <Link to={party.href} className="hover:underline">
          <PartyAvatar
            name={party.name}
            tone={isCustomerInvoice(invoice) ? "success" : "primary"}
          />
        </Link>
      );
    }
    case "reference": {
      const [first] = referencesOf(invoice);
      return first ? (
        <span className="whitespace-nowrap">
          <span className="text-gray-500">{first.label}</span> {first.value}
        </span>
      ) : (
        <span className="text-gray-400">None</span>
      );
    }
    case "carrierBillNo":
      return !isCustomerInvoice(invoice) && invoice.carrierInvoiceNumber ? (
        <span>{invoice.carrierInvoiceNumber}</span>
      ) : (
        <span className="text-gray-400">Awaiting bill</span>
      );
    case "invoiceDate":
      return (
        <span className="whitespace-nowrap">
          {formatDate(invoice.invoiceDate ?? undefined) ?? "—"}
        </span>
      );
    case "dueDate":
      return (
        <span className="whitespace-nowrap">
          {formatDate(invoice.dueDate ?? undefined) ?? "—"}
        </span>
      );
    case "total":
      return <InvoiceTotal invoice={invoice} />;
    case "balance":
      return <InvoiceBalance invoice={invoice} />;
    case "status":
      return <InvoiceStatusCell invoice={invoice} />;
    default:
      return null;
  }
}
