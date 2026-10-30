import { describe, expect, it } from "vitest";
import {
  CarrierInvoiceStatus,
  CustomerInvoiceStatus,
  InvoiceDirection,
} from "../enums";
import {
  mockInvoiceView,
  mockInvoiceViewPage,
  mockInvoiceViewVersions,
} from "./api-invoices";

const AR = InvoiceDirection.Receivable;

describe("mock invoices in the API's shape", () => {
  it("chains INV-10422's two versions, oldest first", () => {
    const versions = mockInvoiceViewVersions(AR, "INV-10422")!;
    expect(versions.map((v) => [v.id, v.revision, v.status])).toEqual([
      ["INV-10422-0", 0, CustomerInvoiceStatus.Superseded],
      ["INV-10422", 1, CustomerInvoiceStatus.Issued],
    ]);
    expect(versions[1].parentInvoiceId).toBe("INV-10422-0");
    // Opening the old version finds the same chain.
    expect(mockInvoiceViewVersions(AR, "INV-10422-0")!.length).toBe(2);
  });

  it("copies every amount as written", () => {
    const invoice = mockInvoiceView(AR, "INV-10422")!;
    expect(invoice.total).toBe("2221.13");
    expect(invoice.amountPaid).toBe("1000.00");
    expect(invoice.balanceDue).toBe("1221.13");
    expect(invoice.taxes).toEqual([
      expect.objectContaining({ taxable_amount: "1965.60", tax_amount: "255.53" }),
    ]);
  });

  it("holds no charges on a carrier bill not received yet", () => {
    const invoice = mockInvoiceView(InvoiceDirection.Payable, "CINV-10422")!;
    expect(invoice.status).toBe(CarrierInvoiceStatus.Expected);
    expect(invoice.total).toBe("0.00");
  });

  it("keeps the directions apart", () => {
    expect(mockInvoiceView(InvoiceDirection.Payable, "INV-10421")).toBeUndefined();
  });

  it("lists replaced versions only when asked for", () => {
    const ids = (status?: string) =>
      mockInvoiceViewPage(AR, { page: 1, limit: 50, status }).items.map((i) => i.id);
    expect(ids()).not.toContain("INV-10422-0");
    expect(ids(CustomerInvoiceStatus.Superseded)).toEqual(["INV-10422-0"]);
  });
});
