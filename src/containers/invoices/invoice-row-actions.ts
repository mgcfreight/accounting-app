import { InvoiceDirection, InvoiceStatus } from "@/lib/enums";
import { Invoice } from "@/lib/interfaces";
import { InvoiceAction } from "./invoice-action-modal";

// Which actions an invoice offers, from its status (design §7, §8.2). Issued
// invoices are never edited; they change through credit and debit notes.
export const availableActions = (
  invoice: Invoice
): { key: InvoiceAction; label: string }[] => {
  const closed = [InvoiceStatus.Void, InvoiceStatus.WrittenOff].includes(
    invoice.status
  );
  if (closed) return [];

  const isDraft = invoice.status === InvoiceStatus.Draft;
  const isReceivable = invoice.direction === InvoiceDirection.Receivable;

  return [
    ...(isDraft
      ? [
          {
            key: "issue" as const,
            label: isReceivable ? "Issue & send" : "Confirm as payable",
          },
        ]
      : []),
    ...(!isReceivable
      ? [{ key: "carrier-bill" as const, label: "Enter carrier bill" }]
      : []),
    ...(!isDraft
      ? [
          { key: "charge" as const, label: "Add charge" },
          { key: "credit" as const, label: "Credit note" },
        ]
      : []),
    ...(isReceivable && !isDraft && !invoice.disputed
      ? [{ key: "dispute" as const, label: "Flag dispute" }]
      : []),
  ];
};
