import { describe, expect, it } from "vitest";
import { InvoiceDirection, ReviewKind } from "@/lib/enums";
import list from "./__fixtures__/reviews/list.json";
import { envelope, paginated, reviewItemSchema } from "./schemas";

// GET /invoice/review as the Accounts API sends it (ReviewItemView in
// mgcfreight/accounting#65): one row of each kind, both sides, and a draft
// with no number yet. Replace with a captured response when the endpoint is
// on a shared environment.

const parse = (body: unknown) =>
  envelope(paginated(reviewItemSchema)).parse(body).data.items;

describe("review item schema", () => {
  it("reads amount changes and cancellations on both sides", () => {
    const items = parse(list);
    expect(new Set(items.map((item) => item.kind))).toEqual(
      new Set([ReviewKind.AmountChange, ReviewKind.Cancellation])
    );
    expect(new Set(items.map((item) => item.direction))).toEqual(
      new Set([InvoiceDirection.Receivable, InvoiceDirection.Payable])
    );
  });

  it("reads a draft with no invoice number", () => {
    const draft = parse(list).find((item) => item.invoiceStatus === "DRAFT");
    expect(draft?.invoiceNumber).toBeNull();
    expect(draft?.newAmount).toBe("0.00");
  });

  it("refuses an amount sent as a number, or a version below 1", () => {
    const [first] = list.data.items;
    const withItem = (item: object) => ({
      ...list,
      data: { ...list.data, items: [{ ...first, ...item }] },
    });
    expect(() => parse(withItem({ newAmount: 1325.5 }))).toThrow();
    expect(() => parse(withItem({ version: 0 }))).toThrow();
  });
});
