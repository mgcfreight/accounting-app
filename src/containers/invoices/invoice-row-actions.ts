import {
  CarrierInvoiceStatus,
  CustomerInvoiceStatus,
  InvoiceKind,
  Permission,
} from "@/lib/enums";
import { InvoiceAction } from "./invoice-action-modal";
import { InvoiceView, isCustomerInvoice } from "./invoice-view";

// The permission each action's endpoint asks for (the API's
// invoice.controller), per side.
const actionPermission = (
  action: InvoiceAction,
  isCustomer: boolean
): Permission => {
  switch (action) {
    case "issue":
      return Permission.CustomerInvoicesIssue;
    case "approve":
      return Permission.CarrierInvoicesApprove;
    case "edit":
    case "receive":
      return isCustomer
        ? Permission.CustomerInvoicesEdit
        : Permission.CarrierInvoicesEdit;
    case "revise":
      return isCustomer
        ? Permission.CustomerInvoicesCreate
        : Permission.CarrierInvoicesCreate;
  }
};

const REVISABLE_CARRIER_STATUSES = [
  CarrierInvoiceStatus.Received,
  CarrierInvoiceStatus.OnHold,
  CarrierInvoiceStatus.Approved,
];

// Which actions an invoice offers, from its status — the same rules the API
// enforces — and what the user's role allows (`can`, from useCan). An issued
// customer invoice and an approved carrier invoice are never edited in
// place: they change through a new version that replaces them. A replaced
// or void invoice offers nothing.
export const availableActions = (
  invoice: InvoiceView,
  can: (permission: Permission) => boolean
): { key: InvoiceAction; label: string }[] => {
  const isCustomer = isCustomerInvoice(invoice);
  // Only a standard invoice gets new versions, and a carrier one only once
  // its bill (and so its invoice date) is in.
  const revisable =
    invoice.kind === InvoiceKind.Standard &&
    (isCustomer
      ? invoice.status === CustomerInvoiceStatus.Issued
      : REVISABLE_CARRIER_STATUSES.includes(invoice.status) &&
        invoice.invoiceDate !== null);

  const actions: { key: InvoiceAction; label: string }[] = [];
  if (isCustomer) {
    if (invoice.status === CustomerInvoiceStatus.Draft) {
      actions.push(
        { key: "issue", label: "Issue" },
        { key: "edit", label: "Edit details" }
      );
    }
  } else if (invoice.status === CarrierInvoiceStatus.Expected) {
    actions.push(
      { key: "receive", label: "Enter carrier bill" },
      { key: "edit", label: "Edit details" }
    );
  } else if (
    invoice.status === CarrierInvoiceStatus.Received ||
    invoice.status === CarrierInvoiceStatus.OnHold
  ) {
    actions.push(
      { key: "approve", label: "Approve for payment" },
      { key: "edit", label: "Edit details" }
    );
  }
  if (revisable) {
    actions.push({
      key: "revise",
      label: isCustomer ? "Issue new version" : "Enter changed bill",
    });
  }
  return actions.filter((action) =>
    can(actionPermission(action.key, isCustomer))
  );
};
