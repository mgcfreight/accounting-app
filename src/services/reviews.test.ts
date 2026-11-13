import { describe, expect, it } from "vitest";
import { Currency, InvoiceDirection, ReviewChange, ReviewKind } from "@/lib/enums";
import list from "./__fixtures__/reviews/list.json";
import { envelope, paginated, reviewItemSchema } from "./schemas";

// GET /invoice/review as the Accounts API sends it (ReviewItemView in
// mgcfreight/accounting#65 at 38a84b7): one row of each kind, both sides, a
// draft with no number yet, and an expected bill the sync already updated. Replace with a captured response when the endpoint is
// on a shared environment.

const parse = (body: unknown) =>
  envelope(paginated(reviewItemSchema)).parse(body).data.items;

describe("review item schema", () => {
  it("reads changes and cancellations on both sides", () => {
    const items = parse(list);
    expect(new Set(items.map((item) => item.kind))).toEqual(
      new Set([ReviewKind.TmsChange, ReviewKind.Cancellation])
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

  it("reads the amount now, before, in MGC Freight, and what changed (PR #42 review)", () => {
    const updated = parse(list).find((item) => item.updatedFromTms);
    expect(updated).toMatchObject({
      currentAmount: "600.00",
      previousAmount: "500.00",
      newAmount: "600.00",
      tmsCurrency: Currency.USD,
      changes: [ReviewChange.Total],
    });
  });

  it("refuses a change it doesn't know", () => {
    const [first] = list.data.items;
    expect(() =>
      parse({ ...list, data: { ...list.data, items: [{ ...first, changes: ["COLOUR"] }] } })
    ).toThrow();
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
