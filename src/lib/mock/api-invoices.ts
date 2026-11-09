import {
  BillingTrigger,
  CarrierInvoiceStatus,
  CustomerInvoiceStatus,
  InvoiceDirection,
  InvoiceKind,
  InvoiceStatus,
  PaymentStatus,
  PaymentTerms,
  TaxBasis,
} from "../enums";
import {
  CarrierInvoiceView,
  CustomerInvoiceView,
  Invoice,
  InvoiceTax,
  InvoiceViewBase,
  Paginated,
} from "../interfaces";
import {
  findInvoice,
  invoiceVersions,
  mockCarrierInvoices,
  mockShipperInvoices,
} from "./invoices";

// The mock invoices in the Accounts API's shape, for the invoice pages to
// fall back on in development when the API can't answer (see
// containers/invoices/demo-invoices.ts). Every amount is copied from
// invoices.ts as written there; nothing is added up here.

// The tax labels invoices.ts uses, as the API's tax rows.
const TAXES: Record<string, Pick<InvoiceTax, "code" | "rate_percent" | "jurisdiction">> = {
  "GST 5% + QST 9.975%": { code: "GST+QST", rate_percent: "14.975", jurisdiction: "QC" },
  "HST ON 13%": { code: "HST", rate_percent: "13", jurisdiction: "ON" },
  "HST NB 15%": { code: "HST", rate_percent: "15", jurisdiction: "NB" },
  "GST 5%": { code: "GST", rate_percent: "5", jurisdiction: "" },
  "Zero-rated (export)": { code: "ZR", rate_percent: "0", jurisdiction: "" },
};

// One tax row for the invoice: every mock invoice taxes all its lines at one
// rate, so the row is its subtotal and tax total, as written.
const taxesOf = (invoice: Invoice): InvoiceTax[] => {
  const labels = new Set(invoice.lines.map((line) => line.taxCode));
  if (labels.size !== 1) {
    throw new Error(`Mock invoice ${invoice.id} mixes tax rates`);
  }
  const tax = TAXES[[...labels][0]];
  if (!tax) throw new Error(`Mock invoice ${invoice.id} has an unknown tax`);
  return [
    {
      tax_rate_id: `mock-${tax.code}-${tax.jurisdiction}`,
      ...tax,
      taxable_amount: invoice.subtotal,
      tax_amount: invoice.taxTotal,
    },
  ];
};

// What has been paid, as written: no mock invoice has two payments.
const amountPaidOf = (invoice: Invoice) => {
  if (invoice.payments.length > 1) {
    throw new Error(`Mock invoice ${invoice.id} has more than one payment`);
  }
  return invoice.payments[0]?.amount ?? "0.00";
};

const baseOf = (invoice: Invoice): InvoiceViewBase => ({
  id: invoice.id,
  tmsInvoiceCode: null,
  sequenceValue: null,
  suffix: "",
  kind: InvoiceKind.Standard,
  shipmentId: invoice.shipmentId,
  agreementId: `mock-agreement-${invoice.partyId}`,
  paymentStatus:
    invoice.status === InvoiceStatus.Paid ? PaymentStatus.Paid : PaymentStatus.Unpaid,
  currency: invoice.currency,
  fxRateToCad: null,
  paymentTerms: PaymentTerms.Net30,
  invoiceDate: invoice.invoiceDate,
  dueDate: invoice.dueDate,
  taxBasis: TaxBasis.Destination,
  taxJurisdiction: TAXES[invoice.lines[0]?.taxCode]?.jurisdiction ?? "",
  bolNumber: null,
  pickupNumber: null,
  poNumber: null,
  soNumber: null,
  proNumber: null,
  quoteNumber: null,
  billNumber: null,
  subtotal: invoice.subtotal,
  taxes: taxesOf(invoice),
  taxTotal: invoice.taxTotal,
  total: invoice.total,
  amountPaid: amountPaidOf(invoice),
  balanceDue: invoice.balance,
  notes: null,
  reviewFlags: [],
  parentInvoiceId: invoice.replacesId ?? null,
  revision: invoice.revision ?? 0,
  revisionReason: invoice.revisionReason ?? null,
  supersededAt: invoice.replacedAt ?? null,
  version: 1,
  createdAt: invoice.history[0]?.at ?? `${invoice.invoiceDate}T12:00:00.000Z`,
  updatedAt: invoice.history[invoice.history.length - 1]?.at ?? `${invoice.invoiceDate}T12:00:00.000Z`,
  lines: invoice.lines.map((line, index) => ({
    id: `${invoice.id}-${line.id}`,
    lineNo: index + 1,
    chargeTypeCode: line.kind,
    description: line.description,
    quantity: "1",
    unitPrice: line.amount,
    amount: line.amount,
    isTaxable: line.taxAmount !== "0.00",
    mgcChargeId: null,
  })),
});

const customerStatus: Record<InvoiceStatus, CustomerInvoiceStatus> = {
  [InvoiceStatus.Draft]: CustomerInvoiceStatus.Draft,
  [InvoiceStatus.Issued]: CustomerInvoiceStatus.Issued,
  // A part-payment stays ISSUED and UNPAID; amountPaid tells "part paid".
  [InvoiceStatus.PartiallyPaid]: CustomerInvoiceStatus.Issued,
  [InvoiceStatus.Paid]: CustomerInvoiceStatus.Issued,
  [InvoiceStatus.Superseded]: CustomerInvoiceStatus.Superseded,
  [InvoiceStatus.Void]: CustomerInvoiceStatus.Void,
  [InvoiceStatus.WrittenOff]: CustomerInvoiceStatus.Issued,
};

const carrierStatus: Record<InvoiceStatus, CarrierInvoiceStatus> = {
  // A mock carrier draft is a bill not received yet.
  [InvoiceStatus.Draft]: CarrierInvoiceStatus.Expected,
  [InvoiceStatus.Issued]: CarrierInvoiceStatus.Approved,
  [InvoiceStatus.PartiallyPaid]: CarrierInvoiceStatus.Approved,
  [InvoiceStatus.Paid]: CarrierInvoiceStatus.Approved,
  [InvoiceStatus.Superseded]: CarrierInvoiceStatus.Superseded,
  [InvoiceStatus.Void]: CarrierInvoiceStatus.Void,
  [InvoiceStatus.WrittenOff]: CarrierInvoiceStatus.Approved,
};

const toCustomerView = (invoice: Invoice): CustomerInvoiceView => {
  const [city, province] = invoice.destination.split(", ");
  return {
    ...baseOf(invoice),
    invoiceNumber: invoice.number,
    customerId: invoice.partyId,
    status: customerStatus[invoice.status],
    billTo: {
      name: invoice.partyName,
      legal_name: null,
      gst_hst_number: null,
      address_line1: null,
      address_line2: null,
      city: city ?? null,
      province: province ?? null,
      postal_code: null,
      country: "CA",
    },
    issuedAt:
      invoice.status === InvoiceStatus.Draft ? null : `${invoice.invoiceDate}T12:00:00.000Z`,
    sentAt: null,
  };
};

const toCarrierView = (invoice: Invoice): CarrierInvoiceView => {
  const status = carrierStatus[invoice.status];
  const expected = status === CarrierInvoiceStatus.Expected;
  const base = baseOf(invoice);
  return {
    ...base,
    // Until the bill arrives the API holds no charges, only what's expected.
    ...(expected && {
      subtotal: "0.00",
      taxes: [],
      taxTotal: "0.00",
      total: "0.00",
      balanceDue: "0.00",
      lines: [],
    }),
    referenceNumber: invoice.number,
    carrierInvoiceNumber: invoice.carrierBillNo ?? null,
    carrierId: invoice.partyId,
    status,
    billingTrigger: BillingTrigger.OnDeliveryWithPod,
    expectedTotal: invoice.subtotal,
    varianceAmount: null,
    receivedAt: expected ? null : `${invoice.invoiceDate}T12:00:00.000Z`,
    approvedAt: expected ? null : `${invoice.invoiceDate}T12:00:00.000Z`,
    approvedById: null,
    holdReason: null,
  };
};

const toView = (invoice: Invoice) =>
  invoice.direction === InvoiceDirection.Receivable
    ? toCustomerView(invoice)
    : toCarrierView(invoice);

export const mockInvoiceView = (direction: InvoiceDirection, id: string) => {
  const invoice = findInvoice(id);
  return invoice && invoice.direction === direction ? toView(invoice) : undefined;
};

// Every version, oldest first, as GET …/versions sends them.
export const mockInvoiceViewVersions = (direction: InvoiceDirection, id: string) => {
  const invoice = findInvoice(id);
  return invoice && invoice.direction === direction
    ? invoiceVersions(invoice).map(toView)
    : undefined;
};

// One page of the list, unfiltered. Like the API, replaced versions are
// listed only when asked for.
export const mockInvoiceViewPage = (
  direction: InvoiceDirection,
  { page, limit, status }: { page: number; limit: number; status?: string }
): Paginated<CustomerInvoiceView | CarrierInvoiceView> => {
  const source =
    direction === InvoiceDirection.Receivable ? mockShipperInvoices : mockCarrierInvoices;
  const superseded = source.flatMap((invoice) =>
    invoiceVersions(invoice).slice(0, -1)
  );
  const matching = status
    ? [...source, ...superseded]
        .map(toView)
        .filter((invoice) => invoice.status === status)
    : source.map(toView);
  return {
    items: matching.slice((page - 1) * limit, page * limit),
    meta: {
      currentPage: page,
      itemCount: Math.min(limit, Math.max(0, matching.length - (page - 1) * limit)),
      itemsPerPage: limit,
      totalItems: matching.length,
      totalPages: Math.max(1, Math.ceil(matching.length / limit)),
    },
  };
};
