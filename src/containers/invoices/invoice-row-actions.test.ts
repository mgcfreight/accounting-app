import { describe, expect, it } from "vitest";
import { InvoiceStatus, Permission } from "@/lib/enums";
import { findInvoice, invoiceVersions } from "@/lib/mock";
import { availableActions } from "./invoice-row-actions";

const canEverything = () => true;
const keys = (id: string, can: (permission: Permission) => boolean) =>
  availableActions(findInvoice(id)!, can).map((action) => action.key);

describe("availableActions: invoice versions", () => {
  it("offers a new version on an issued invoice", () => {
    expect(keys("INV-10421", canEverything)).toContain("revise");
  });

  it("does not offer one on a draft, which is still edited directly", () => {
    const draft = findInvoice("INV-10425");
    expect(draft?.status).toBe(InvoiceStatus.Draft);
    expect(keys("INV-10425", canEverything)).not.toContain("revise");
  });

  it("offers nothing on a replaced version", () => {
    expect(keys("INV-10422-0", canEverything)).toEqual([]);
  });

  it("needs the create permission, not edit", () => {
    expect(
      keys("INV-10421", (p) => p === Permission.CustomerInvoicesEdit)
    ).not.toContain("revise");
    expect(
      keys("INV-10421", (p) => p === Permission.CustomerInvoicesCreate)
    ).toContain("revise");
  });
});

describe("invoiceVersions", () => {
  it("lists every version oldest first, from either end", () => {
    const fromNew = invoiceVersions(findInvoice("INV-10422")!);
    const fromOld = invoiceVersions(findInvoice("INV-10422-0")!);

    expect(fromNew.map((v) => v.number)).toEqual(["INV-10422", "INV-10422a"]);
    expect(fromOld).toEqual(fromNew);
  });

  it("is just the invoice when it was never changed", () => {
    expect(invoiceVersions(findInvoice("INV-10421")!)).toHaveLength(1);
  });
});
