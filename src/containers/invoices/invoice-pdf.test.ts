import { describe, expect, it } from "vitest";
import {
  Currency,
  CustomerInvoiceStatus,
  InvoiceKind,
  PaymentStatus,
  PaymentTerms,
  TaxBasis,
} from "@/lib/enums";
import { CompanySettings, CustomerInvoiceView } from "@/lib/interfaces";
import {
  invoicePdfTitle,
  isPrintable,
  MalformedAmountError,
  toInvoicePdfHtml,
  versionLabel,
} from "./invoice-pdf";

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

const company: CompanySettings = {
  legalName: "MGC Freight Inc.",
  gstHstNumber: "123456789RT0001",
  addressLine1: "100 Front St",
  addressLine2: null,
  city: "Toronto",
  province: "ON",
  postalCode: "M5J 1E3",
  country: "CA",
  accountsNotificationEmail: null,
  updatedAt: null,
  updatedBy: null,
};

const html = (overrides: Partial<CustomerInvoiceView> = {}, extra = {}) =>
  toInvoicePdfHtml({
    invoice: invoice(overrides),
    partyName: "Acme Foods Ltd",
    company,
    ...extra,
  });

describe("toInvoicePdfHtml", () => {
  it("prints the API's amounts with their currency", () => {
    const page = html();
    expect(page).toContain("CAD 1,243.00");
    expect(page).toContain("HST 13% (ON) on CAD 1,100.00");
    expect(page).toContain("GST/HST # 123456789RT0001");
    expect(page).toContain("Version 1");
  });

  it("prints a line's unit price at the API's precision", () => {
    const page = html();
    expect(page).toContain("CAD 1100.0000");
    expect(page).toContain(">1.000<");
  });

  it("escapes every value from the API", () => {
    const page = html({
      billTo: { ...invoice().billTo, name: "<img src=x onerror=alert(1)>" },
    });
    expect(page).not.toContain("<img");
    expect(page).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("leaves internal notes and the revision reason off", () => {
    const page = html({ revisionReason: "Shipper complained" });
    expect(page).not.toContain("slow to pay");
    expect(page).not.toContain("Shipper complained");
  });

  it("marks a replaced version so nobody pays against it", () => {
    const newer = invoice({ id: "sin_b", invoiceNumber: "230a", revision: 1 });
    const page = html(
      {
        status: CustomerInvoiceStatus.Superseded,
        supersededAt: "2026-10-25T14:00:00.000Z",
      },
      { replacedBy: newer, versionCount: 2 }
    );
    expect(page).toContain("REPLACED");
    expect(page).toContain("replaced by 230a (Version 2)");
    expect(page).toContain("Version 1 of 2");
    expect(page).toMatch(/Balance due<\/td><td class="num">Replaced/);
  });

  it("says which version a revision replaces", () => {
    const older = invoice();
    const page = html(
      { id: "sin_b", invoiceNumber: "230a", revision: 1, parentInvoiceId: older.id },
      { replaces: older }
    );
    expect(page).toContain("Revised invoice: replaces 230 (Version 1).");
  });

  it("refuses to print a malformed amount rather than guess", () => {
    expect(() => html({ total: "12.5" })).toThrow(MalformedAmountError);
  });
});

describe("versions and file names", () => {
  it("numbers versions from 1", () => {
    expect(versionLabel(invoice({ revision: 2 }), 3)).toBe("Version 3 of 3");
    expect(invoicePdfTitle(invoice({ invoiceNumber: "230b", revision: 2 }))).toBe(
      "Invoice 230b - Version 3"
    );
  });

  it("has nothing to print for a draft", () => {
    expect(isPrintable(invoice({ status: CustomerInvoiceStatus.Draft }))).toBe(false);
    expect(isPrintable(invoice())).toBe(true);
  });
});
