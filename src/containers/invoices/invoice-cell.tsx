import { Link } from "react-router";
import {
  InvoiceFlags,
  InvoiceStatusChip,
  Money,
  PartyAvatar,
} from "@/components/common";
import { InvoiceDirection, InvoiceStatus } from "@/lib/enums";
import { Invoice } from "@/lib/interfaces";
import { formatDate } from "@/lib/utils";

export const invoiceHref = (invoice: Invoice) =>
  `${
    invoice.direction === InvoiceDirection.Receivable
      ? "/shipper-invoices"
      : "/carrier-invoices"
  }/view/?id=${encodeURIComponent(invoice.id)}`;

// One renderCell for every invoice table, so a column looks the same on the
// dashboard, the lists and the party pages.
export default function InvoiceCell({
  invoice,
  columnKey,
}: {
  invoice: Invoice;
  columnKey: string;
}) {
  switch (columnKey) {
    case "number":
      return (
        <Link
          to={invoiceHref(invoice)}
          className="font-bold text-base-primary-300 hover:underline whitespace-nowrap"
        >
          {invoice.number}
        </Link>
      );
    case "party":
      return (
        <PartyAvatar
          name={invoice.partyName}
          subtitle={invoice.shipmentId}
          tone={
            invoice.direction === InvoiceDirection.Receivable
              ? "success"
              : "primary"
          }
        />
      );
    case "lane":
      return (
        <div className="w-40">
          <h6 className="uppercase font-bold">{invoice.origin}</h6>
          <p className="text-gray-500">to {invoice.destination}</p>
        </div>
      );
    case "carrierBillNo":
      return invoice.carrierBillNo ? (
        <span>{invoice.carrierBillNo}</span>
      ) : (
        <span className="text-gray-400">Awaiting bill</span>
      );
    case "invoiceDate":
      return (
        <span className="whitespace-nowrap">
          {formatDate(invoice.invoiceDate)}
        </span>
      );
    case "dueDate":
      return (
        <span className="whitespace-nowrap">{formatDate(invoice.dueDate)}</span>
      );
    case "total":
      return <Money amount={invoice.total} currency={invoice.currency} />;
    case "balance":
      // A draft or void invoice owes nothing yet, but "0.00" beside it reads
      // as "paid", so say what it is instead.
      if (invoice.status === InvoiceStatus.Draft) {
        return <span className="text-gray-400">Not issued</span>;
      }
      if (invoice.status === InvoiceStatus.Void) {
        return <span className="text-gray-400">—</span>;
      }
      return (
        <Money
          amount={invoice.balance}
          currency={invoice.currency}
          className="font-semibold"
        />
      );
    case "status":
      return (
        <div className="flex flex-col items-start gap-1">
          <InvoiceStatusChip status={invoice.status} />
          <InvoiceFlags
            overdueDays={invoice.overdueDays}
            disputed={invoice.disputed}
          />
        </div>
      );
    default:
      return null;
  }
}
