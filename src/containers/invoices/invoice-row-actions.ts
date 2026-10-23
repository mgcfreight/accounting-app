import {
  CarrierInvoiceStatus,
  CustomerInvoiceStatus,
  UserRole,
} from "@/lib/enums";
import { InvoiceAction } from "./invoice-action-modal";
import { InvoiceView, isCustomerInvoice } from "./invoice-view";

// Which actions an invoice offers, from its status — the same rules the API
// enforces. Viewers get none. Issued customer invoices and approved carrier
// invoices are never edited.
export const availableActions = (
  invoice: InvoiceView,
  role: UserRole
): { key: InvoiceAction; label: string }[] => {
  if (role === UserRole.Viewer) return [];

  if (isCustomerInvoice(invoice)) {
    return invoice.status === CustomerInvoiceStatus.Draft
      ? [
          { key: "issue", label: "Issue" },
          { key: "edit", label: "Edit details" },
        ]
      : [];
  }

  switch (invoice.status) {
    case CarrierInvoiceStatus.Expected:
      return [
        { key: "receive", label: "Enter carrier bill" },
        { key: "edit", label: "Edit details" },
      ];
    case CarrierInvoiceStatus.Received:
    case CarrierInvoiceStatus.OnHold:
      return [
        { key: "approve", label: "Approve for payment" },
        { key: "edit", label: "Edit details" },
      ];
    default:
      return [];
  }
};
