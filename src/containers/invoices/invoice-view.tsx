import { Link, useNavigate } from "react-router";
import {
  CarrierInvoiceStatusChip,
  CustomerInvoiceStatusChip,
  Money,
  PartyAvatar,
  PaymentStatusChip,
  RowActions,
  StatusChip,
} from "@/components/common";
import { EyeIcon } from "@/components/icons";
import {
  CarrierInvoiceStatus,
  CustomerInvoiceStatus,
  InvoiceDirection,
} from "@/lib/enums";
import {
  CarrierInvoiceView,
  CustomerInvoiceView,
  PartyView,
  ReferenceNumbers,
} from "@/lib/interfaces";
import { isZeroMoney } from "@/lib/money";
import { daysPastDue, formatDate, torontoToday } from "@/lib/utils";

// Helpers and one renderCell for invoices from the Accounts API, used by the
// invoice lists, the invoice page, the dashboard and the party and shipment
// pages.

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

// The API sends a party's id, not its name. A customer invoice carries the
// name it was billed to; a carrier's is looked up (usePartyNames) and, until
// it arrives or if it can't be read, the carrier's id stands in for it.
export const partyOf = (
  invoice: InvoiceView,
  parties?: Map<string, PartyView>
) =>
  isCustomerInvoice(invoice)
    ? {
        id: invoice.customerId,
        name: invoice.billTo.name,
        href: `/shippers/view/?id=${encodeURIComponent(invoice.customerId)}`,
      }
    : {
        id: invoice.carrierId,
        name: parties?.get(invoice.carrierId)?.name ?? invoice.carrierId,
        href: `/carriers/view/?id=${encodeURIComponent(invoice.carrierId)}`,
      };

// The carrier ids on a set of invoices, for usePartyNames.
export const carrierIdsOf = (invoices: InvoiceView[]) =>
  invoices.map((invoice) =>
    isCustomerInvoice(invoice) ? null : invoice.carrierId
  );

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

// Replaced by a newer version: kept as it was sent, but what it owed moved
// to the new version, so it owes nothing itself.
export const isSuperseded = (invoice: InvoiceView) =>
  invoice.status === CustomerInvoiceStatus.Superseded ||
  invoice.status === CarrierInvoiceStatus.Superseded;

// Review flags matter until the invoice goes out or is approved.
export const awaitsReview = (invoice: InvoiceView) =>
  invoice.reviewFlags.length > 0 &&
  (isCustomerInvoice(invoice)
    ? invoice.status === CustomerInvoiceStatus.Draft
    : invoice.status === CarrierInvoiceStatus.Expected ||
      invoice.status === CarrierInvoiceStatus.Received ||
      invoice.status === CarrierInvoiceStatus.OnHold);

// The statuses in which an invoice is owed: issued to the customer, or the
// carrier's bill entered.
const OWED_CARRIER_STATUSES = [
  CarrierInvoiceStatus.Received,
  CarrierInvoiceStatus.OnHold,
  CarrierInvoiceStatus.Approved,
];

// Owed and not paid off: what overdue flags, reminders and disputes apply to.
export const isOwed = (invoice: InvoiceView) =>
  (isCustomerInvoice(invoice)
    ? invoice.status === CustomerInvoiceStatus.Issued
    : OWED_CARRIER_STATUSES.includes(invoice.status)) &&
  !isZeroMoney(invoice.balanceDue);

// Days past its due date, for an owed invoice; 0 when it isn't overdue.
// Calendar dates compare as text.
export const overdueDaysOf = (invoice: InvoiceView, today = torontoToday()) =>
  isOwed(invoice) && invoice.dueDate && invoice.dueDate < today
    ? daysPastDue(invoice.dueDate, today)
    : 0;

export function InvoiceStatusCell({ invoice }: { invoice: InvoiceView }) {
  const overdueDays = overdueDaysOf(invoice);
  return (
    <div className="flex flex-wrap items-start gap-1">
      {isCustomerInvoice(invoice) ? (
        <CustomerInvoiceStatusChip status={invoice.status} />
      ) : (
        <CarrierInvoiceStatusChip status={invoice.status} />
      )}
      {!owesNothingYet(invoice) && !isVoid(invoice) && !isSuperseded(invoice) && (
        <PaymentStatusChip
          status={invoice.paymentStatus}
          amountPaid={invoice.amountPaid}
        />
      )}
      {overdueDays > 0 && (
        <StatusChip text={`Overdue ${overdueDays}d`} tone="danger" />
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
  if (isSuperseded(invoice)) {
    return <span className="text-gray-400">Replaced</span>;
  }
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
// is expected to be is shown instead, marked as such. expectedTotal is the
// expected subtotal, before tax, so it says so beside the taxed totals.
export function InvoiceTotal({ invoice }: { invoice: InvoiceView }) {
  if (
    !isCustomerInvoice(invoice) &&
    invoice.status === CarrierInvoiceStatus.Expected
  ) {
    return (
      <span className="text-gray-500 whitespace-nowrap">
        Expected{" "}
        <Money amount={invoice.expectedTotal} currency={invoice.currency} />{" "}
        before tax
      </span>
    );
  }
  return <Money amount={invoice.total} currency={invoice.currency} />;
}

// The eye button that opens an invoice, for the "actions" column of tables
// that list invoices without acting on them (party and shipment pages).
export function InvoiceViewAction({ invoice }: { invoice: InvoiceView }) {
  const navigate = useNavigate();
  return (
    <RowActions
      actions={[
        {
          key: "view",
          label: "View details",
          icon: <EyeIcon />,
          onPress: () => navigate(apiInvoiceHref(invoice)),
        },
      ]}
    />
  );
}

export default function InvoiceViewCell({
  invoice,
  columnKey,
  parties,
}: {
  invoice: InvoiceView;
  columnKey: string;
  // Carriers' names by id (usePartyNames), for the party column.
  parties?: Map<string, PartyView>;
}) {
  switch (columnKey) {
    case "number": {
      const number = invoiceNumberOf(invoice);
      return (
        <div className="flex flex-col items-start gap-1">
          <Link
            to={apiInvoiceHref(invoice)}
            className={`hover:underline whitespace-nowrap ${
              number ? "font-bold text-base-primary-300" : "text-gray-500"
            }`}
          >
            {number ?? "No number yet"}
          </Link>
          {/* A revised invoice: its earlier versions are on its page. */}
          {invoice.revision > 0 && (
            <StatusChip
              text={`Version ${invoice.revision + 1}`}
              tone="secondary"
              className="px-2 py-0.5"
            />
          )}
        </div>
      );
    }
    case "party": {
      const party = partyOf(invoice, parties);
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
