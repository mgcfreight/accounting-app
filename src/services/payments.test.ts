import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  AllocationRule,
  MatchStatus,
  PaymentRecordStatus,
} from "@/lib/enums";
import allocated from "./__fixtures__/payments/allocate.json";
import list from "./__fixtures__/payments/list.json";
import openInvoices from "./__fixtures__/payments/open-invoices.json";
import recorded from "./__fixtures__/payments/record.json";
import reversedAllocation from "./__fixtures__/payments/reverse-allocation.json";
import reversedPayment from "./__fixtures__/payments/reverse-payment.json";
import suggestion from "./__fixtures__/payments/suggestion.json";
import {
  allocationSuggestionSchema,
  customerInvoiceSchema,
  envelope,
  invoicePaymentSchema,
  paginated,
  paymentSchema,
} from "./schemas";

// The fixtures are real responses from the Accounts API (mgcfreight/
// accounting feature/25-billing-notices), captured over HTTP: a shipper with
// two issued invoices, a 1500.00 payment, its suggestion, an allocation of
// 1130.00 + 300.00, the 300.00 reversed, then the whole payment reversed.

const payment = envelope(paymentSchema);

describe("paymentSchema on real responses", () => {
  it("reads a recorded payment, all unapplied, with its suggestion", () => {
    const { data } = payment.parse(recorded);
    expect([data.number, data.amount, data.unapplied, data.match]).toEqual([
      expect.stringMatching(/^SPAY-\d+$/),
      "1500.00",
      "1500.00",
      MatchStatus.Unmatched,
    ]);
    expect(data.allocations).toEqual([]);
    expect(data.suggested.length).toBeGreaterThan(0);
  });

  it("reads the suggestion", () => {
    const { data } = envelope(allocationSuggestionSchema).parse(suggestion);
    expect(data.unapplied).toBe("1500.00");
    expect(data.allocations[0].rule).toBe(AllocationRule.OldestOpen);
  });

  it("reads allocations with their balances and rules", () => {
    const { data } = payment.parse(allocated);
    expect([data.unapplied, data.match]).toEqual(["70.00", MatchStatus.Partial]);
    expect(
      data.allocations.map((a) => [a.amount, a.rule, a.reversedAt])
    ).toEqual(
      expect.arrayContaining([
        ["1130.00", AllocationRule.OldestOpen, null],
        ["300.00", AllocationRule.Manual, null],
      ])
    );
  });

  it("reads a reversed allocation, kept with its time", () => {
    const { data } = payment.parse(reversedAllocation);
    expect(data.unapplied).toBe("370.00");
    expect(data.allocations.filter((a) => a.reversedAt !== null)).toHaveLength(1);
  });

  it("reads a reversed payment with its reason", () => {
    const { data } = payment.parse(reversedPayment);
    expect([data.status, data.reversalReason]).toEqual([
      PaymentRecordStatus.Reversed,
      "Cheque returned NSF",
    ]);
  });

  it("reads the paged list", () => {
    const { data } = envelope(paginated(paymentSchema)).parse(list);
    expect(data.meta.totalItems).toBe(1);
    expect(data.items[0].partyName).toMatch(/^Capture /);
  });

  it("reads the open invoices the allocate form lists, with `disputed`", () => {
    const { data } = envelope(paginated(customerInvoiceSchema)).parse(
      openInvoices
    );
    expect(data.items.length).toBeGreaterThan(0);
    expect(data.items.every((i) => typeof i.disputed === "boolean")).toBe(true);
  });

  it("refuses an amount that is not 2 decimals rather than showing it", () => {
    const bad = { ...recorded, data: { ...recorded.data, amount: "1500.5" } };
    expect(() => payment.parse(bad)).toThrow();
  });
});

// Written from the API's InvoicePaymentView (src/dto/payment/payment.view.ts),
// not captured: one live allocation and one reversed.
const invoicePayments = {
  message: "Success",
  data: [
    {
      allocationId: "cpa_4fK9qZ0aB1",
      paymentId: "cpy_4fK9qZ0aB1",
      paymentNumber: "SPAY-12",
      method: "EFT",
      paidOn: "2026-10-20",
      reference: "sin_EGP9wr_230",
      amount: "1130.00",
      rule: "INVOICE_NUMBER",
      allocatedOn: "2026-10-21",
      reversedAt: null,
    },
    {
      allocationId: "cpa_7hT2mW5cD3",
      paymentId: "cpy_7hT2mW5cD3",
      paymentNumber: "SPAY-9",
      method: "CHEQUE",
      paidOn: "2026-10-02",
      reference: null,
      amount: "300.00",
      rule: "MANUAL",
      allocatedOn: "2026-10-03",
      reversedAt: "2026-10-05T14:12:09.000Z",
    },
  ],
};

describe("invoicePaymentSchema", () => {
  const list = envelope(z.array(invoicePaymentSchema));

  it("reads the payments behind an invoice, reversed ones included", () => {
    const { data } = list.parse(invoicePayments);
    expect(data.map((p) => [p.paymentNumber, p.amount, p.rule, p.reversedAt])).toEqual([
      ["SPAY-12", "1130.00", AllocationRule.InvoiceNumber, null],
      ["SPAY-9", "300.00", AllocationRule.Manual, "2026-10-05T14:12:09.000Z"],
    ]);
  });

  it("refuses an amount that is not 2 decimals rather than showing it", () => {
    const [first] = invoicePayments.data;
    expect(() =>
      list.parse({ ...invoicePayments, data: [{ ...first, amount: "1130" }] })
    ).toThrow();
  });
});
