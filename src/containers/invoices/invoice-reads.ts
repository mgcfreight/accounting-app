import { InvoiceDirection } from "@/lib/enums";
import { getCarrierInvoiceVersions, getCustomerInvoiceVersions } from "@/services";
import { InvoiceView } from "./invoice-view";

// Every version of an invoice from the Accounts API, oldest first, by
// direction: shipper (receivable) or carrier (payable). A failed read
// throws; the page shows the error.
export const fetchInvoiceVersions = (
  direction: InvoiceDirection,
  id: string,
  signal?: AbortSignal
): Promise<InvoiceView[]> =>
  direction === InvoiceDirection.Receivable
    ? getCustomerInvoiceVersions(id, signal)
    : getCarrierInvoiceVersions(id, signal);
