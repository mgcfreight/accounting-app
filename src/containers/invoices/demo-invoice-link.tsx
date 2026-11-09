import { Fragment } from "react";

// An invoice number on a page that still runs on lib/mock (payments,
// reminders, Needs Review, statements). Plain text: the number is a mock
// one, and the invoice pages read the Accounts API, which doesn't have it.
// Link it to its invoice page once the page that shows it reads the API.
export function DemoInvoiceLink({
  number,
  className = "",
}: {
  number: string;
  className?: string;
}) {
  return <span className={`font-bold whitespace-nowrap ${className}`}>{number}</span>;
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
