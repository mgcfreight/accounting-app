import { describe, expect, it } from "vitest";
import {
  BillingTrigger,
  CarrierInvoiceStatus,
  Currency,
  CustomerInvoiceStatus,
  InvoiceKind,
  PaymentStatus,
  PaymentTerms,
  Permission,
  TaxBasis,
} from "@/lib/enums";
import {
  CarrierInvoiceView,
  CustomerInvoiceView,
  InvoiceViewBase,
} from "@/lib/interfaces";
import { availableActions } from "./invoice-row-actions";

const base: InvoiceViewBase = {
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
  taxes: [],
  taxTotal: "143.00",
  total: "1243.00",
  amountPaid: "0.00",
  balanceDue: "1243.00",
  notes: null,
  reviewFlags: [],
  parentInvoiceId: null,
  revision: 0,
  revisionReason: null,
  supersededAt: null,
  version: 1,
  createdAt: "2026-10-21T18:05:00.000Z",
  updatedAt: "2026-10-21T18:05:00.000Z",
};

const customer = (
  overrides: Partial<CustomerInvoiceView> = {}
): CustomerInvoiceView => ({
  ...base,
  invoiceNumber: "sin_EGP9wr_230",
  customerId: "pty_4fK9qZ0aB1",
  status: CustomerInvoiceStatus.Issued,
  billTo: {
    name: "Acme Foods Ltd",
    legal_name: null,
    gst_hst_number: null,
    address_line1: null,
    address_line2: null,
    city: "Toronto",
    province: "ON",
    postal_code: null,
    country: "CA",
  },
  issuedAt: "2026-10-21T18:10:00.000Z",
  sentAt: null,
  ...overrides,
});

const carrier = (
  overrides: Partial<CarrierInvoiceView> = {}
): CarrierInvoiceView => ({
  ...base,
  id: "cin_a1b2c3d4e5",
  referenceNumber: "cin_K3pQ7x_230",
  carrierInvoiceNumber: "SH-55102",
  carrierId: "pty_9xQ2mL0cD3",
  status: CarrierInvoiceStatus.Received,
  billingTrigger: BillingTrigger.OnShipmentCreated,
  expectedTotal: "900.00",
  varianceAmount: "0.00",
  receivedAt: "2026-10-22T14:00:00.000Z",
  approvedAt: null,
  approvedById: null,
  holdReason: null,
  ...overrides,
});

const canEverything = () => true;
const keys = (
  invoice: CustomerInvoiceView | CarrierInvoiceView,
  can: (permission: Permission) => boolean = canEverything
) => availableActions(invoice, can).map((action) => action.key);

describe("availableActions: customer invoices", () => {
  it("offers issue and edit on a draft, but no new version", () => {
    expect(keys(customer({ status: CustomerInvoiceStatus.Draft }))).toEqual([
      "issue",
      "edit",
    ]);
  });

  it("offers only a new version once issued", () => {
    expect(keys(customer())).toEqual(["revise"]);
  });

  it("offers nothing on a replaced or void invoice", () => {
    expect(keys(customer({ status: CustomerInvoiceStatus.Superseded }))).toEqual(
      []
    );
    expect(keys(customer({ status: CustomerInvoiceStatus.Void }))).toEqual([]);
  });

  it("offers no new version of an adjustment or credit note", () => {
    expect(keys(customer({ kind: InvoiceKind.CreditNote }))).toEqual([]);
  });

  it("needs the create permission for a new version, not edit", () => {
    expect(keys(customer(), (p) => p === Permission.CustomerInvoicesEdit)).toEqual(
      []
    );
    expect(
      keys(customer(), (p) => p === Permission.CustomerInvoicesCreate)
    ).toEqual(["revise"]);
  });

  it("needs the issue permission to issue", () => {
    const draft = customer({ status: CustomerInvoiceStatus.Draft });
    expect(keys(draft, (p) => p === Permission.CustomerInvoicesEdit)).toEqual([
      "edit",
    ]);
  });
});

describe("availableActions: carrier invoices", () => {
  it("offers the bill and edit while expected", () => {
    const expected = carrier({
      status: CarrierInvoiceStatus.Expected,
      invoiceDate: null,
    });
    expect(keys(expected)).toEqual(["receive", "edit"]);
  });

  it("offers approve, edit and a new version once the bill is in", () => {
    expect(keys(carrier())).toEqual(["approve", "edit", "revise"]);
    expect(keys(carrier({ status: CarrierInvoiceStatus.OnHold }))).toEqual([
      "approve",
      "edit",
      "revise",
    ]);
  });

  it("offers only a new version once approved", () => {
    expect(keys(carrier({ status: CarrierInvoiceStatus.Approved }))).toEqual([
      "revise",
    ]);
  });

  it("offers nothing on a replaced invoice", () => {
    expect(keys(carrier({ status: CarrierInvoiceStatus.Superseded }))).toEqual(
      []
    );
  });

  it("asks each action's own permission", () => {
    expect(keys(carrier(), (p) => p === Permission.CarrierInvoicesApprove)).toEqual(
      ["approve"]
    );
    expect(keys(carrier(), () => false)).toEqual([]);
  });
});
