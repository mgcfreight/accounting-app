import { describe, expect, it } from "vitest";
import { InstallmentPlanAttention, InstallmentStatus, PaymentDirection } from "@/lib/enums";
import { envelope, installmentPlanSchema, paginated } from "./schemas";

// GET /installment-plan/all as the Accounts API sends it
// (InstallmentPlanView in mgcfreight/accounting#78): a part-paid shipper
// plan with a late installment, and a carrier plan on a draft-numberless
// invoice. Replace with a captured response when one is available.
const plan = {
  id: "ipl_4fK9qZ0aB1",
  direction: PaymentDirection.In,
  partyId: "pty_4fK9qZ0aB1",
  partyName: "Prairie Agri Inc.",
  invoices: [{ id: "cin_9fK2qZ0aB1", number: "sin_EGP9wr_230" }],
  currency: "CAD",
  total: "2320.50",
  paid: "773.50",
  remaining: "1547.00",
  attention: [],
  frequency: "BIWEEKLY",
  agreedOn: "2026-10-17",
  installments: [
    // The API always sends paidOn as null for now.
    { number: 1, dueDate: "2026-10-24", amount: "773.50", status: "PAID", paidOn: null },
    { number: 2, dueDate: "2026-11-07", amount: "773.50", status: "LATE", paidOn: null },
    { number: 3, dueDate: "2026-11-21", amount: "773.50", status: "DUE", paidOn: null },
  ],
  createdAt: "2026-10-17T14:02:11.000Z",
  cancelledAt: null,
  cancelReason: null,
};
const body = (items: object[]) => ({
  message: "Success",
  data: {
    items,
    meta: { totalItems: items.length, itemCount: items.length, itemsPerPage: 10, totalPages: 1, currentPage: 1 },
  },
});
const parse = (value: unknown) =>
  envelope(paginated(installmentPlanSchema)).parse(value).data.items;

describe("installment plan schema", () => {
  it("reads a plan with paid, late and due installments", () => {
    const [read] = parse(body([plan]));
    expect(read.installments.map((item) => item.status)).toEqual([
      InstallmentStatus.Paid,
      InstallmentStatus.Late,
      InstallmentStatus.Due,
    ]);
    expect(read.remaining).toBe("1547.00");
  });

  it("reads an invoice with no number yet", () => {
    const [read] = parse(
      body([{ ...plan, direction: "OUT", invoices: [{ id: "cri_1", number: null }] }])
    );
    expect(read.invoices[0].number).toBeNull();
  });

  it("keeps why a plan needs attention, rather than dropping it", () => {
    const [read] = parse(
      body([{ ...plan, attention: ["INVOICE_VOIDED", "AMOUNT_CHANGED"] }])
    );
    expect(read.attention).toEqual([
      InstallmentPlanAttention.InvoiceVoided,
      InstallmentPlanAttention.AmountChanged,
    ]);
  });

  it("refuses a plan with no attention list, or a reason it doesn't know", () => {
    const { attention: _omitted, ...withoutAttention } = plan;
    expect(() => parse(body([withoutAttention]))).toThrow();
    expect(() => parse(body([{ ...plan, attention: ["SOMETHING_ELSE"] }]))).toThrow();
  });

  it("keeps when and why a plan was cancelled (PR #43 review)", () => {
    const [read] = parse(
      body([{ ...plan, cancelledAt: "2026-11-02T10:00:00.000Z", cancelReason: "Shipper paid in full" }])
    );
    expect(read.cancelledAt).toBe("2026-11-02T10:00:00.000Z");
    expect(read.cancelReason).toBe("Shipper paid in full");
  });

  it("refuses money sent as a number", () => {
    expect(() => parse(body([{ ...plan, total: 2320.5 }]))).toThrow();
  });
});
