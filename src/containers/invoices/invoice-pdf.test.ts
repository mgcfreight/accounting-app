import { describe, expect, it } from "vitest";
import {
  Currency,
  CustomerInvoiceStatus,
  InvoiceKind,
  PaymentStatus,
  PaymentTerms,
  TaxBasis,
} from "@/lib/enums";
import { CustomerInvoiceView } from "@/lib/interfaces";
import { isPrintable, versionLabel } from "./invoice-pdf";

const invoice = (
  overrides: Partial<CustomerInvoiceView> = {}
): CustomerInvoiceView => ({
  id: "sin_a1b2c3d4e5",
  tmsInvoiceCode: "EGP9wr",
  sequenceValue: "230",
  suffix: "",
  kind: InvoiceKind.Standard,
  shipmentId: "shp_4fK9qZ0aB1",
  agreementId: "agr_4fK9qZ0aB1",
  paymentStatus: PaymentStatus.Unpaid,
  currency: Currency.CAD,
  fxRateToCad: null,
  paymentTerms: PaymentTerms.Net30,
  invoiceDate: "2026-10-21",
  dueDate: "2026-11-20",
  taxBasis: TaxBasis.BillTo,
  taxJurisdiction: "ON",
  bolNumber: "BOL-88231",
  pickupNumber: null,
  poNumber: null,
  soNumber: null,
  proNumber: null,
  quoteNumber: null,
  billNumber: null,
  subtotal: "1100.00",
  taxes: [
    {
      tax_rate_id: "txr_1",
      code: "HST",
      jurisdiction: "ON",
      rate_percent: "13",
      taxable_amount: "1100.00",
      tax_amount: "143.00",
    },
  ],
  taxTotal: "143.00",
  total: "1243.00",
  amountPaid: "0.00",
  balanceDue: "1243.00",
  notes: "Internal: shipper is slow to pay",
  reviewFlags: [],
  parentInvoiceId: null,
  revision: 0,
  revisionReason: null,
  supersededAt: null,
  version: 1,
  createdAt: "2026-10-21T18:05:00.000Z",
  updatedAt: "2026-10-21T18:05:00.000Z",
  lines: [
    {
      id: "lin_1",
      lineNo: 1,
      chargeTypeCode: "FRT",
      description: "Linehaul",
      // As the API sends them: quantity to 3 places, unit price to 4.
      quantity: "1.000",
      unitPrice: "1100.0000",
      amount: "1100.00",
      isTaxable: true,
      mgcChargeId: null,
    },
  ],
  invoiceNumber: "230",
  customerId: "pty_4fK9qZ0aB1",
  status: CustomerInvoiceStatus.Issued,
  billTo: {
    name: "Acme Foods Ltd",
    legal_name: null,
    gst_hst_number: null,
    address_line1: "1 King St",
    address_line2: null,
    city: "Toronto",
    province: "ON",
    postal_code: "M5H 1A1",
    country: "CA",
  },
  issuedAt: "2026-10-21T18:05:00.000Z",
  sentAt: null,
  ...overrides,
});

describe("versions", () => {
  it("numbers versions from 1", () => {
    expect(versionLabel(invoice({ revision: 2 }), 3)).toBe("Version 3 of 3");
  });

  it("has nothing to print for a draft", () => {
    expect(isPrintable(invoice({ status: CustomerInvoiceStatus.Draft }))).toBe(false);
    expect(isPrintable(invoice())).toBe(true);
  });
});
