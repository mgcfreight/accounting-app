import {
  CarrierInvoiceStatus,
  CustomerInvoiceStatus,
  Permission,
} from "@/lib/enums";
import { InvoiceView, isCustomerInvoice } from "./invoice-view";

// Who may get an invoice version's PDF, and when there is one. The PDF
// itself comes from the API (downloadInvoicePdf).

// A draft or an awaited carrier bill has nothing to print yet.
export const isPrintable = (invoice: InvoiceView) =>
  isCustomerInvoice(invoice)
    ? invoice.status !== CustomerInvoiceStatus.Draft
    : invoice.status !== CarrierInvoiceStatus.Expected;

export const canExportPdf = (
  invoice: InvoiceView,
  can: (permission: Permission) => boolean
) =>
  can(
    isCustomerInvoice(invoice)
      ? Permission.CustomerInvoicesExportPdf
      : Permission.CarrierInvoicesExportPdf
  );

// "Version 2 of 3": revision 0 is the first version.
export const versionLabel = (invoice: InvoiceView, count?: number) =>
  `Version ${invoice.revision + 1}${count ? ` of ${count}` : ""}`;
