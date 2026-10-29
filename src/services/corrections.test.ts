import { describe, expect, it } from "vitest";
import {
  CarrierInvoiceStatus,
  CustomerInvoiceStatus,
  InvoiceKind,
} from "@/lib/enums";
import carrierAdjustment from "./__fixtures__/invoices/carrier-adjustment.json";
import creditNote from "./__fixtures__/invoices/credit-note.json";
import { carrierInvoiceSchema, customerInvoiceSchema, envelope } from "./schemas";

// Real responses from the Accounts API (mgcfreight/accounting
// feature/25-billing-notices) over the local demo data, captured over HTTP
// as an Admin: a credit note on a shipper invoice, and a carrier's extra
// charge on its bill.

describe("adjustments and credit notes on real responses", () => {
  it("reads a shipper credit note, made as a draft under its parent", () => {
    const { data } = envelope(customerInvoiceSchema).parse(creditNote);
    expect(data.kind).toBe(InvoiceKind.CreditNote);
    expect(data.status).toBe(CustomerInvoiceStatus.Draft);
    expect(data.parentInvoiceId).not.toBeNull();
    expect(data.lines?.length).toBeGreaterThan(0);
  });

  it("reads a carrier's extra charge, recorded as received", () => {
    const { data } = envelope(carrierInvoiceSchema).parse(carrierAdjustment);
    expect(data.kind).toBe(InvoiceKind.Adjustment);
    expect(data.status).toBe(CarrierInvoiceStatus.Received);
    expect(data.carrierInvoiceNumber).toBe("CB-DEMO-X1");
  });
});
