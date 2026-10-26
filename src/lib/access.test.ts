import { describe, expect, it } from "vitest";
import { can, canAny, hasAccess } from "./access";
import { Permission } from "./enums";

const viewer = {
  isAdmin: false,
  permissions: [Permission.PartiesView, Permission.CustomerInvoicesView],
};
const admin = { isAdmin: true, permissions: [] };

describe("can", () => {
  it("needs every permission asked for", () => {
    expect(can(viewer, Permission.PartiesView)).toBe(true);
    expect(
      can(viewer, Permission.PartiesView, Permission.PartiesCreate)
    ).toBe(false);
  });

  it("lets an Admin do anything, whatever the list says", () => {
    expect(can(admin, Permission.CarrierPaymentsVoid)).toBe(true);
  });
});

describe("canAny", () => {
  it("needs one of the options", () => {
    expect(
      canAny(viewer, Permission.CarrierInvoicesView, Permission.PartiesView)
    ).toBe(true);
    expect(canAny(viewer, Permission.CarrierInvoicesView)).toBe(false);
  });

  it("refuses an empty list to a non-Admin", () => {
    expect(canAny(viewer)).toBe(false);
  });
});

describe("hasAccess", () => {
  it("reads each kind of rule", () => {
    expect(hasAccess(viewer, { anyUser: true })).toBe(true);
    expect(hasAccess(viewer, { adminOnly: true })).toBe(false);
    expect(hasAccess(admin, { adminOnly: true })).toBe(true);
    expect(
      hasAccess(viewer, {
        allOf: [Permission.PartiesView, Permission.CustomerInvoicesView],
      })
    ).toBe(true);
    expect(
      hasAccess(viewer, {
        anyOf: [Permission.ReportsView, Permission.CarrierInvoicesView],
      })
    ).toBe(false);
  });
});
