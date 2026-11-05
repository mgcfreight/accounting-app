import { InvoiceDirection } from "@/lib/enums";
import { Paginated } from "@/lib/interfaces";
import {
  mockInvoiceView,
  mockInvoiceViewByNumber,
  mockInvoiceViewPage,
  mockInvoiceViewVersions,
} from "@/lib/mock";
import {
  CarrierInvoiceListParams,
  CustomerInvoiceListParams,
  getCarrierInvoice,
  getCarrierInvoiceByNumber,
  getCarrierInvoiceVersions,
  getCustomerInvoice,
  getCustomerInvoiceByNumber,
  getCustomerInvoiceVersions,
  listCarrierInvoices,
  listCustomerInvoices,
} from "@/services";
import { InvoiceView, isInvoiceNumber } from "./invoice-view";

// The invoice pages' reads, with lib/mock to fall back on while the API has
// no invoices to show: when a read fails, or the unfiltered list is empty.
// Development only (`npm run dev`) — a build never shows demo figures as
// real ones; there the API's error shows. Demo invoices are marked
// (isDemoInvoice) so the page says so and offers nothing that would write.

export const DEMO_FALLBACK = import.meta.env.DEV;

const demoIds = new Set<string>();

export const isDemoInvoice = (invoice: InvoiceView) => demoIds.has(invoice.id);

const markDemo = <T extends InvoiceView>(invoices: T[]) => {
  invoices.forEach((invoice) => demoIds.add(invoice.id));
  return invoices;
};

const withDemo = async <T>(
  read: () => Promise<T>,
  demo: () => T | undefined,
  signal?: AbortSignal
): Promise<T> => {
  try {
    return await read();
  } catch (error) {
    if (!DEMO_FALLBACK || signal?.aborted) throw error;
    const data = demo();
    if (data === undefined) throw error;
    return data;
  }
};

// `id` is the invoice number, or the internal id of a draft without one.
export const fetchInvoice = (
  direction: InvoiceDirection,
  id: string,
  signal?: AbortSignal
): Promise<InvoiceView> =>
  withDemo<InvoiceView>(
    () => {
      const byNumber = isInvoiceNumber(id);
      if (direction === InvoiceDirection.Receivable) {
        return byNumber
          ? getCustomerInvoiceByNumber(id, signal)
          : getCustomerInvoice(id, signal);
      }
      return byNumber
        ? getCarrierInvoiceByNumber(id, signal)
        : getCarrierInvoice(id, signal);
    },
    () => {
      // Mock numbers don't look like the API's, so try the number first: a
      // record id can equal another version's number (INV-10422).
      const invoice =
        mockInvoiceViewByNumber(direction, id) ?? mockInvoiceView(direction, id);
      return invoice && markDemo([invoice])[0];
    },
    signal
  );

export const fetchInvoiceVersions = (
  direction: InvoiceDirection,
  id: string,
  signal?: AbortSignal
): Promise<InvoiceView[]> =>
  withDemo<InvoiceView[]>(
    () =>
      direction === InvoiceDirection.Receivable
        ? getCustomerInvoiceVersions(id, signal)
        : getCarrierInvoiceVersions(id, signal),
    () => {
      const versions = mockInvoiceViewVersions(direction, id);
      return versions && markDemo(versions);
    },
    signal
  );

type ListParams = CustomerInvoiceListParams | CarrierInvoiceListParams;

// The mock list ignores search and payment filters; the page says so.
const demoPage = (direction: InvoiceDirection, params: ListParams) => {
  const page = mockInvoiceViewPage(direction, params);
  markDemo(page.items);
  return page;
};

export const fetchInvoicePage = async (
  direction: InvoiceDirection,
  params: ListParams,
  signal?: AbortSignal
): Promise<Paginated<InvoiceView>> => {
  const page = await withDemo<Paginated<InvoiceView>>(
    () =>
      direction === InvoiceDirection.Receivable
        ? listCustomerInvoices(params as CustomerInvoiceListParams, signal)
        : listCarrierInvoices(params as CarrierInvoiceListParams, signal),
    () => demoPage(direction, params),
    signal
  );
  const unfiltered = !params.searchQuery && !params.status && !params.paymentStatus;
  return DEMO_FALLBACK && unfiltered && page.meta.totalItems === 0
    ? demoPage(direction, params)
    : page;
};
