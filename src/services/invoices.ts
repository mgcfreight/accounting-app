import { z } from "zod";
import {
  CarrierInvoiceStatus,
  CustomerInvoiceStatus,
  InvoiceSortBy,
  PaymentStatus,
  SortOrder,
} from "@/lib/enums";
import { ReferenceNumbers } from "@/lib/interfaces";
import { apiClient, parseBody } from "./api-client";
import {
  carrierInvoiceSchema,
  customerInvoiceSchema,
  envelope,
  invoiceChargeTypeSchema,
  paginated,
} from "./schemas";

// Customer invoices (money in) and carrier invoices (money out), /invoice.
// Invoices are made with their shipment (services/shipments.ts); these read
// them and move them on. Each action needs its permission
// (customer_invoices.* / carrier_invoices.*); the API answers 403 otherwise.
// `invoiceId` travels as a query param.
//
// Every change sends the `version` it was based on. If someone else changed
// the invoice since, the API answers 409 rather than overwrite them: refetch
// and try again. Every figure comes back calculated — nothing here does
// arithmetic on money.

type InvoiceListParams = {
  page: number;
  // At most 100.
  limit: number;
  // The start of an invoice number, or an exact reference number.
  searchQuery?: string;
  paymentStatus?: PaymentStatus;
  shipmentId?: string;
  // Omitted: newest first.
  sortBy?: InvoiceSortBy;
  order?: SortOrder;
};

// Without `status`, every status except SUPERSEDED (old versions).
export type CustomerInvoiceListParams = InvoiceListParams & {
  status?: CustomerInvoiceStatus;
  customerId?: string;
};

export type CarrierInvoiceListParams = InvoiceListParams & {
  status?: CarrierInvoiceStatus;
  carrierId?: string;
};

// On an update an empty string clears a reference number.
export type ReferenceNumberChanges = Partial<
  Record<keyof ReferenceNumbers, string>
>;

// What an invoice is missing before it goes out. Only the fields being
// changed are sent. Amounts are never changed here.
export type InvoiceChanges = ReferenceNumberChanges & {
  version: number;
  // 6 letters or digits; gives the invoice its number.
  tmsInvoiceCode?: string;
  // USD invoices only: rate to CAD, up to 6 decimals.
  fxRateToCad?: string;
  notes?: string;
};

// One charge, which becomes one invoice line. Amounts are strings, so no
// cent is lost to a float.
export type Charge = {
  chargeTypeCode: string;
  // Defaults to the charge type's name.
  description?: string;
  // Above zero, up to 3 decimals. Defaults to "1".
  quantity?: string;
  // Up to 4 decimals.
  unitPrice: string;
  mgcChargeId?: string;
};

export type CarrierBill = {
  version: number;
  // The carrier's own bill number.
  carrierInvoiceNumber: string;
  // The date printed on the bill, "YYYY-MM-DD"; picks the tax rate.
  invoiceDate: string;
  // Before tax; 1-50.
  lines: Charge[];
};

// A new version of an invoice whose service changed. `lines` are the whole
// new set of charges, not the difference; tax is worked out again on them.
type Revision = {
  version: number;
  // 3-255 characters; shown in the version history.
  reason: string;
  // Before tax; 1-50.
  lines: Charge[];
  // Replaces the notes; leave out to keep them, "" to clear.
  notes?: string;
};

export type CustomerRevision = Revision & { acknowledgeReview?: boolean };
export type CarrierRevision = Revision & { carrierInvoiceNumber?: string };

// Void for a cancelled load. An optional cancellation fee, before tax, is
// billed on a new draft invoice with the next letter (230 -> 230a).
export type VoidInvoice = {
  version: number;
  // 3-255 characters.
  reason: string;
  cancellationFee?: string;
};

// The API rejects empty query values, so leave out unset ones.
const listQuery = (params: InvoiceListParams) => ({
  page: params.page,
  limit: params.limit,
  searchQuery: params.searchQuery || undefined,
  paymentStatus: params.paymentStatus,
  shipmentId: params.shipmentId,
  sortBy: params.sortBy,
  order: params.sortBy ? params.order : undefined,
});

const customerInvoice = envelope(customerInvoiceSchema);
const carrierInvoice = envelope(carrierInvoiceSchema);

// The active charge types an invoice line can use.
export const getInvoiceChargeTypes = (signal?: AbortSignal) =>
  apiClient
    .get("/invoice/charge-types", { signal })
    .then(
      (res) =>
        parseBody(envelope(z.array(invoiceChargeTypeSchema)), res.data).data
    );

// ------------------------------------------------------------- customer

export const listCustomerInvoices = (
  params: CustomerInvoiceListParams,
  signal?: AbortSignal
) =>
  apiClient
    .get("/invoice/customer/all", {
      params: {
        ...listQuery(params),
        status: params.status,
        customerId: params.customerId,
      },
      signal,
    })
    .then(
      (res) =>
        parseBody(envelope(paginated(customerInvoiceSchema)), res.data).data
    );

// With its lines.
export const getCustomerInvoice = (invoiceId: string, signal?: AbortSignal) =>
  apiClient
    .get("/invoice/customer", { params: { invoiceId }, signal })
    .then((res) => parseBody(customerInvoice, res.data).data);

// Every version of the invoice, superseded ones included.
export const getCustomerInvoiceVersions = (
  invoiceId: string,
  signal?: AbortSignal
) =>
  apiClient
    .get("/invoice/customer/versions", { params: { invoiceId }, signal })
    .then(
      (res) =>
        parseBody(envelope(z.array(customerInvoiceSchema)), res.data).data
    );

// Drafts only.
export const updateCustomerInvoice = (
  invoiceId: string,
  changes: InvoiceChanges
) =>
  apiClient
    .put("/invoice/customer", changes, { params: { invoiceId } })
    .then((res) => parseBody(customerInvoice, res.data).data);

// Needs a TMS code and a reference number. An invoice with review flags
// needs `acknowledgeReview: true`, which the audit log records. After this
// its amounts never change.
export const issueCustomerInvoice = (
  invoiceId: string,
  body: { version: number; acknowledgeReview?: boolean }
) =>
  apiClient
    .put("/invoice/customer/issue", body, { params: { invoiceId } })
    .then((res) => parseBody(customerInvoice, res.data).data);

// Replaces the invoice with a new version (230 -> 230a) and returns it.
export const reviseCustomerInvoice = (
  invoiceId: string,
  revision: CustomerRevision
) =>
  apiClient
    .post("/invoice/customer/revise", revision, { params: { invoiceId } })
    .then((res) => parseBody(customerInvoice, res.data).data);

// A draft or issued invoice nothing has been applied to.
export const voidCustomerInvoice = (invoiceId: string, body: VoidInvoice) =>
  apiClient
    .put("/invoice/customer/void", body, { params: { invoiceId } })
    .then((res) => parseBody(customerInvoice, res.data).data);

// -------------------------------------------------------------- carrier

export const listCarrierInvoices = (
  params: CarrierInvoiceListParams,
  signal?: AbortSignal
) =>
  apiClient
    .get("/invoice/carrier/all", {
      params: {
        ...listQuery(params),
        status: params.status,
        carrierId: params.carrierId,
      },
      signal,
    })
    .then(
      (res) =>
        parseBody(envelope(paginated(carrierInvoiceSchema)), res.data).data
    );

// With its lines.
export const getCarrierInvoice = (invoiceId: string, signal?: AbortSignal) =>
  apiClient
    .get("/invoice/carrier", { params: { invoiceId }, signal })
    .then((res) => parseBody(carrierInvoice, res.data).data);

export const getCarrierInvoiceVersions = (
  invoiceId: string,
  signal?: AbortSignal
) =>
  apiClient
    .get("/invoice/carrier/versions", { params: { invoiceId }, signal })
    .then(
      (res) => parseBody(envelope(z.array(carrierInvoiceSchema)), res.data).data
    );

// Until it is approved.
export const updateCarrierInvoice = (
  invoiceId: string,
  changes: InvoiceChanges
) =>
  apiClient
    .put("/invoice/carrier", changes, { params: { invoiceId } })
    .then((res) => parseBody(carrierInvoice, res.data).data);

// The carrier's bill, against an EXPECTED invoice. The due date counts from
// today. A subtotal different from expected puts the invoice ON_HOLD.
export const receiveCarrierInvoice = (invoiceId: string, bill: CarrierBill) =>
  apiClient
    .put("/invoice/carrier/receive", bill, { params: { invoiceId } })
    .then((res) => parseBody(carrierInvoice, res.data).data);

// RECEIVED or ON_HOLD only; approving ON_HOLD accepts the difference.
// Carriers paid on delivery with proof need `podReceived: true`; review
// flags need `acknowledgeReview: true`.
export const approveCarrierInvoice = (
  invoiceId: string,
  body: { version: number; podReceived?: boolean; acknowledgeReview?: boolean }
) =>
  apiClient
    .put("/invoice/carrier/approve", body, { params: { invoiceId } })
    .then((res) => parseBody(carrierInvoice, res.data).data);

export const reviseCarrierInvoice = (
  invoiceId: string,
  revision: CarrierRevision
) =>
  apiClient
    .post("/invoice/carrier/revise", revision, { params: { invoiceId } })
    .then((res) => parseBody(carrierInvoice, res.data).data);

// A carrier invoice nothing has been paid on.
export const voidCarrierInvoice = (invoiceId: string, body: VoidInvoice) =>
  apiClient
    .put("/invoice/carrier/void", body, { params: { invoiceId } })
    .then((res) => parseBody(carrierInvoice, res.data).data);
