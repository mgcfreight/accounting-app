import { InvoiceDirection } from "@/lib/enums";
import { Paginated } from "@/lib/interfaces";
import {
  CarrierInvoiceListParams,
  CustomerInvoiceListParams,
  getCarrierInvoice,
  getCarrierInvoiceVersions,
  getCustomerInvoice,
  getCustomerInvoiceVersions,
  listCarrierInvoices,
  listCustomerInvoices,
} from "@/services";
import { InvoiceView } from "./invoice-view";

// The invoice pages' reads from the Accounts API, by direction: shipper
// (receivable) or carrier (payable). A failed read throws; the page shows
// the error.

export const fetchInvoice = (
  direction: InvoiceDirection,
  id: string,
  signal?: AbortSignal
): Promise<InvoiceView> =>
  direction === InvoiceDirection.Receivable
    ? getCustomerInvoice(id, signal)
    : getCarrierInvoice(id, signal);

export const fetchInvoiceVersions = (
  direction: InvoiceDirection,
  id: string,
  signal?: AbortSignal
): Promise<InvoiceView[]> =>
  direction === InvoiceDirection.Receivable
    ? getCustomerInvoiceVersions(id, signal)
    : getCarrierInvoiceVersions(id, signal);

export const fetchInvoicePage = (
  direction: InvoiceDirection,
  params: CustomerInvoiceListParams | CarrierInvoiceListParams,
  signal?: AbortSignal
): Promise<Paginated<InvoiceView>> =>
  direction === InvoiceDirection.Receivable
    ? listCustomerInvoices(params as CustomerInvoiceListParams, signal)
    : listCarrierInvoices(params as CarrierInvoiceListParams, signal);
