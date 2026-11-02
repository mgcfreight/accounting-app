import { Fragment } from "react";
import { Link } from "react-router";
import { useCurrentUser } from "@/components/providers/user-provider";
import { findInvoiceByNumber } from "@/lib/mock";
import { canAccessRoute } from "@/lib/routes.config";
import { DEMO_FALLBACK } from "./demo-invoices";
import { invoiceListHref } from "./invoice-view";

// An invoice number on a page that still runs on lib/mock (payments,
// reminders, Needs Review, statements), opening the invoice's page. The
// number is looked up in lib/mock, and only development links it: there the
// invoice page falls back to the same mock invoices, while a build would find
// nothing in the API. Plain text, too, when the invoice isn't found or the
// role can't open that side's invoices.
export function DemoInvoiceLink({
  number,
  className = "",
}: {
  number: string;
  className?: string;
}) {
  const user = useCurrentUser();
  const invoice = DEMO_FALLBACK ? findInvoiceByNumber(number) : undefined;
  const list = invoice && invoiceListHref(invoice.direction);
  if (!invoice || !list || !canAccessRoute(`${list}view/`, user)) {
    return <span className={`font-bold whitespace-nowrap ${className}`}>{number}</span>;
  }
  return (
    <Link
      to={`${list}view/?id=${encodeURIComponent(invoice.id)}`}
      className={`font-bold text-base-primary-300 hover:underline whitespace-nowrap ${className}`}
    >
      {number}
    </Link>
  );
}

// Several invoice numbers, comma separated.
export function DemoInvoiceLinks({
  numbers,
  className,
}: {
  numbers: string[];
  className?: string;
}) {
  return (
    <span>
      {numbers.map((number, index) => (
        <Fragment key={number}>
          {index > 0 && ", "}
          <DemoInvoiceLink number={number} className={className} />
        </Fragment>
      ))}
    </span>
  );
}
