import { describe, expect, it } from "vitest";
import { DisputeOutcome, DisputeStatus, InvoiceDirection } from "@/lib/enums";
import all from "./__fixtures__/disputes/all.json";
import { disputeSchema, envelope, paginated } from "./schemas";

// Real responses from the Accounts API (mgcfreight/accounting
// feature/25-billing-notices) over the local demo data (local-seed
// `disputes`), captured over HTTP as an Admin; the staff name is replaced.

const parse = (body: unknown) =>
  envelope(paginated(disputeSchema)).parse(body).data.items;

describe("dispute schema on real responses", () => {
  it("reads open and resolved disputes on both sides", () => {
    const items = parse(all);
    expect(new Set(items.map((d) => d.direction))).toEqual(
      new Set([InvoiceDirection.Receivable, InvoiceDirection.Payable])
    );
    const open = items.find((d) => d.status === DisputeStatus.Open);
    expect(open?.outcome).toBeNull();
    expect(open?.resolvedOn).toBeNull();
  });

  it("reads a shipper dispute resolved by a write-off", () => {
    const written = parse(all).find((d) => d.outcome === DisputeOutcome.WriteOff);
    expect(written?.direction).toBe(InvoiceDirection.Receivable);
    expect(written?.resolution).toBeTruthy();
    expect(written?.resolvedBy).toBe("Demo Admin");
  });

  it("refuses a resolved dispute's amount sent as a number", () => {
    const [first] = all.data.items;
    const bad = {
      ...all,
      data: { ...all.data, items: [{ ...first, disputedAmount: 250 }] },
    };
    expect(() => parse(bad)).toThrow();
  });
});
