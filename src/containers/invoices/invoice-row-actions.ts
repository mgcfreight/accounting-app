import { InvoiceDirection, InvoiceStatus, Permission } from "@/lib/enums";
import { Invoice } from "@/lib/interfaces";
import { InvoiceAction } from "./invoice-action-modal";

// The permission behind each action, per side. Flagging a dispute has no
// permission of its own; it changes the invoice, so it needs edit.
const actionPermission = (
  action: InvoiceAction,
  isReceivable: boolean
): Permission => {
  switch (action) {
    case "issue":
      return isReceivable
        ? Permission.CustomerInvoicesIssue
        : Permission.CarrierInvoicesApprove;
    case "carrier-bill":
      return Permission.CarrierInvoicesEdit;
    case "charge":
    case "credit":
      return isReceivable
        ? Permission.CustomerInvoicesCreate
        : Permission.CarrierInvoicesCreate;
    case "dispute":
      return Permission.CustomerInvoicesEdit;
  }
};

// Which actions an invoice offers, from its status (design §7, §8.2) and what
// the user's role allows (`can`, from useCan). Issued invoices are never
// edited; they change through credit and debit notes.
export const availableActions = (
  invoice: Invoice,
  can: (permission: Permission) => boolean
): { key: InvoiceAction; label: string }[] => {
  const closed = [InvoiceStatus.Void, InvoiceStatus.WrittenOff].includes(
    invoice.status
  );
  if (closed) return [];

  const isDraft = invoice.status === InvoiceStatus.Draft;
  const isReceivable = invoice.direction === InvoiceDirection.Receivable;

  const actions: { key: InvoiceAction; label: string }[] = [
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
  return actions.filter((action) =>
    can(actionPermission(action.key, isReceivable))
  );
};
