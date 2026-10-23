import {
  BillingTrigger,
  CarrierInvoiceStatus,
  Currency,
  CustomerInvoiceStatus,
  InvoiceKind,
  InvoiceReviewFlag,
  InvoiceSortBy,
  PaymentStatus,
  PaymentTerms,
  SortOrder,
  TaxBasis,
} from "@/lib/enums";
import {
  CarrierInvoiceView,
  ChargeTypeView,
  CustomerInvoiceView,
  InvoiceBillTo,
  InvoiceLineView,
  InvoiceTax,
  InvoiceViewBase,
  ReferenceNumbers,
} from "@/lib/interfaces";
import { apiClient } from "./api-client";
import {
  isCount,
  isDateOnly,
  isDecimal,
  isMoney,
  isNonEmptyString,
  isOneOf,
  isString,
  isTimestamp,
  orNull,
  parseList,
  parseOptional,
  parsePage,
  parseShape,
  Parser,
  Shape,
  unwrap,
} from "./parse";

// Customer invoices (money in) and carrier invoices (money out), the API's
// /invoice routes. Invoices are made with their shipment (services/
// shipments.ts); these read them and move them on. Anyone signed in reads;
// Admins and Accountants change. The invoice is picked by `invoiceId` in the
// query string.
//
// Every change sends the `version` it was based on. If someone else changed
// the invoice since, the API answers 409 rather than overwrite them: refetch
// and try again. Amounts are never changed by these calls, and every figure
// comes back calculated — nothing here does arithmetic on money.

type InvoiceListQuery = {
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

export type CustomerInvoiceListQuery = InvoiceListQuery & {
  status?: CustomerInvoiceStatus;
  customerId?: string;
};

export type CarrierInvoiceListQuery = InvoiceListQuery & {
  status?: CarrierInvoiceStatus;
  carrierId?: string;
};

// On an update an empty string clears a reference number.
export type ReferenceNumberChanges = Partial<
  Record<keyof ReferenceNumbers, string>
>;

// What an invoice is missing before it goes out. Only the fields being
// changed are sent.
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

const nullableString = orNull(isString);
const isBoolean = (value: unknown) => typeof value === "boolean";

const parseLine = parseShape<InvoiceLineView>({
  id: isNonEmptyString,
  lineNo: isCount,
  chargeTypeCode: isNonEmptyString,
  description: isString,
  quantity: isDecimal,
  unitPrice: isDecimal,
  amount: isMoney,
  isTaxable: isBoolean,
  mgcChargeId: nullableString,
});

const parseTax = parseShape<InvoiceTax>({
  tax_rate_id: isNonEmptyString,
  code: isNonEmptyString,
  jurisdiction: isString,
  rate_percent: isDecimal,
  taxable_amount: isMoney,
  tax_amount: isMoney,
});

const parseBillTo = parseShape<InvoiceBillTo>({
  name: isString,
  legal_name: nullableString,
  gst_hst_number: nullableString,
  address_line1: nullableString,
  address_line2: nullableString,
  city: nullableString,
  province: nullableString,
  postal_code: nullableString,
  country: isString,
});

type Nested = "taxes" | "lines";

const baseFields: Shape<Omit<InvoiceViewBase, Nested>> = {
  id: isNonEmptyString,
  tmsInvoiceCode: nullableString,
  sequenceValue: nullableString,
  suffix: isString,
  kind: isOneOf(InvoiceKind),
  shipmentId: nullableString,
  agreementId: isNonEmptyString,
  paymentStatus: isOneOf(PaymentStatus),
  currency: isOneOf(Currency),
  fxRateToCad: orNull(isDecimal),
  paymentTerms: isOneOf(PaymentTerms),
  invoiceDate: orNull(isDateOnly),
  dueDate: orNull(isDateOnly),
  taxBasis: isOneOf(TaxBasis),
  taxJurisdiction: isString,
  bolNumber: nullableString,
  pickupNumber: nullableString,
  poNumber: nullableString,
  soNumber: nullableString,
  proNumber: nullableString,
  quoteNumber: nullableString,
  billNumber: nullableString,
  subtotal: isMoney,
  taxTotal: isMoney,
  total: isMoney,
  amountPaid: isMoney,
  balanceDue: isMoney,
  notes: nullableString,
  reviewFlags: (value) =>
    Array.isArray(value) && value.every(isOneOf(InvoiceReviewFlag)),
  version: (value) => isCount(value) && value >= 1,
  createdAt: isTimestamp,
  updatedAt: isTimestamp,
};

// Taxes and lines, shared by both kinds. Null if either fails.
const parseNested = (value: unknown) => {
  const record = value as { taxes?: unknown; lines?: unknown };
  const taxes = parseList(parseTax)(record.taxes);
  const lines = parseOptional(parseList(parseLine), record.lines);
  if (taxes === null || lines === null) return null;
  return { taxes, ...(lines && { lines }) };
};

const parseCustomerFields = parseShape<
  Omit<CustomerInvoiceView, Nested | "billTo">
>({
  ...baseFields,
  invoiceNumber: nullableString,
  customerId: isNonEmptyString,
  customerName: isString,
  status: isOneOf(CustomerInvoiceStatus),
  issuedAt: orNull(isTimestamp),
  sentAt: orNull(isTimestamp),
});

export const parseCustomerInvoice: Parser<CustomerInvoiceView> = (value) => {
  const fields = parseCustomerFields(value);
  const nested = fields && parseNested(value);
  const billTo = fields && parseBillTo((value as { billTo?: unknown }).billTo);
  if (!fields || !nested || !billTo) return null;
  return { ...fields, ...nested, billTo };
};

const parseCarrierFields = parseShape<Omit<CarrierInvoiceView, Nested>>({
  ...baseFields,
  referenceNumber: nullableString,
  carrierInvoiceNumber: nullableString,
  carrierId: isNonEmptyString,
  carrierName: isString,
  status: isOneOf(CarrierInvoiceStatus),
  billingTrigger: isOneOf(BillingTrigger),
  expectedTotal: isMoney,
  varianceAmount: orNull(isMoney),
  receivedAt: orNull(isTimestamp),
  approvedAt: orNull(isTimestamp),
  approvedById: nullableString,
  holdReason: nullableString,
});

export const parseCarrierInvoice: Parser<CarrierInvoiceView> = (value) => {
  const fields = parseCarrierFields(value);
  const nested = fields && parseNested(value);
  if (!fields || !nested) return null;
  return { ...fields, ...nested };
};

const parseChargeType = parseShape<ChargeTypeView>({
  code: isNonEmptyString,
  name: isNonEmptyString,
  defaultTaxable: isBoolean,
});

// The active charge types an invoice line can use.
export const getChargeTypes = async (signal?: AbortSignal) =>
  unwrap(
    await apiClient.get("/invoice/charge-types", { signal }),
    parseList(parseChargeType)
  );

// ------------------------------------------------------------- customer

export const getCustomerInvoices = async (
  query: CustomerInvoiceListQuery,
  signal?: AbortSignal
) =>
  unwrap(
    await apiClient.get("/invoice/customer/all", { params: query, signal }),
    parsePage(parseCustomerInvoice)
  );

// With its lines.
export const getCustomerInvoice = async (
  invoiceId: string,
  signal?: AbortSignal
) =>
  unwrap(
    await apiClient.get("/invoice/customer", { params: { invoiceId }, signal }),
    parseCustomerInvoice
  );

// Drafts only.
export const updateCustomerInvoice = async (
  invoiceId: string,
  body: InvoiceChanges
) =>
  unwrap(
    await apiClient.put("/invoice/customer", body, { params: { invoiceId } }),
    parseCustomerInvoice
  );

// Needs a TMS code and a reference number. An invoice with review flags
// needs `acknowledgeReview: true`, which the audit log records. After this
// its amounts never change.
export const issueCustomerInvoice = async (
  invoiceId: string,
  body: { version: number; acknowledgeReview?: boolean }
) =>
  unwrap(
    await apiClient.put("/invoice/customer/issue", body, {
      params: { invoiceId },
    }),
    parseCustomerInvoice
  );

// -------------------------------------------------------------- carrier

export const getCarrierInvoices = async (
  query: CarrierInvoiceListQuery,
  signal?: AbortSignal
) =>
  unwrap(
    await apiClient.get("/invoice/carrier/all", { params: query, signal }),
    parsePage(parseCarrierInvoice)
  );

// With its lines.
export const getCarrierInvoice = async (
  invoiceId: string,
  signal?: AbortSignal
) =>
  unwrap(
    await apiClient.get("/invoice/carrier", { params: { invoiceId }, signal }),
    parseCarrierInvoice
  );

// Until it is approved.
export const updateCarrierInvoice = async (
  invoiceId: string,
  body: InvoiceChanges
) =>
  unwrap(
    await apiClient.put("/invoice/carrier", body, { params: { invoiceId } }),
    parseCarrierInvoice
  );

// The carrier's bill, against an EXPECTED invoice. The due date counts from
// today. A subtotal different from expected puts the invoice ON_HOLD.
export const receiveCarrierInvoice = async (
  invoiceId: string,
  body: CarrierBill
) =>
  unwrap(
    await apiClient.put("/invoice/carrier/receive", body, {
      params: { invoiceId },
    }),
    parseCarrierInvoice
  );

// RECEIVED or ON_HOLD only; approving ON_HOLD accepts the difference.
// Carriers paid on delivery with proof need `podReceived: true`; review
// flags need `acknowledgeReview: true`.
export const approveCarrierInvoice = async (
  invoiceId: string,
  body: { version: number; podReceived?: boolean; acknowledgeReview?: boolean }
) =>
  unwrap(
    await apiClient.put("/invoice/carrier/approve", body, {
      params: { invoiceId },
    }),
    parseCarrierInvoice
  );
