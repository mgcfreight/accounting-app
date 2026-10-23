import { describe, expect, it } from "vitest";
import { Permission } from "./enums";
import { menuForUser } from "./navigation";
import { canAccessRoute, headerButtonFor, routeConfig } from "./routes.config";

const nobody = { isAdmin: false, permissions: [] as Permission[] };
const admin = { isAdmin: true, permissions: [] as Permission[] };
const withPermissions = (...permissions: Permission[]) => ({
  isAdmin: false,
  permissions,
});

describe("canAccessRoute", () => {
  it("refuses a path that isn't in the table", () => {
    expect(canAccessRoute("/not-a-page/", admin)).toBe(false);
  });

  it("gives every top-level route an access rule", () => {
    const missing = Object.entries(routeConfig)
      .filter(([, config]) => !config.access)
      .map(([key]) => key);
    expect(missing).toEqual([]);
  });

  it("opens the pages every user has", () => {
    expect(canAccessRoute("/dashboard/", nobody)).toBe(true);
    expect(canAccessRoute("/account/", nobody)).toBe(true);
    expect(canAccessRoute("/users/sessions/", nobody)).toBe(true);
    expect(canAccessRoute("/settings/audit-log/", nobody)).toBe(true);
  });

  it("keeps users, roles, settings and sync to Admins", () => {
    for (const path of ["/users/", "/roles/", "/settings/", "/sync-status/"]) {
      expect(canAccessRoute(path, nobody)).toBe(false);
      expect(canAccessRoute(path, admin)).toBe(true);
    }
  });

  it("lets a detail page inherit its list's rule", () => {
    const viewer = withPermissions(Permission.CustomerInvoicesView);
    expect(canAccessRoute("/shipper-invoices/view/", viewer)).toBe(true);
    expect(canAccessRoute("/carrier-invoices/view/", viewer)).toBe(false);
  });

  it("opens payments and needs review with either side", () => {
    const carrierSide = withPermissions(
      Permission.CarrierPaymentsView,
      Permission.CarrierInvoicesView
    );
    expect(canAccessRoute("/payments/", carrierSide)).toBe(true);
    expect(canAccessRoute("/needs-review/", carrierSide)).toBe(true);
    expect(canAccessRoute("/payments/", nobody)).toBe(false);
  });
});

describe("headerButtonFor", () => {
  it("hides Record Payment without a create permission", () => {
    const viewOnly = withPermissions(Permission.CustomerPaymentsView);
    expect(headerButtonFor("/payments/", viewOnly)).toBeUndefined();
    expect(
      headerButtonFor(
        "/payments/",
        withPermissions(
          Permission.CustomerPaymentsView,
          Permission.CustomerPaymentsCreate
        )
      )?.action
    ).toBe("record-payment");
  });

  it("never shows a button on a page the user can't open", () => {
    expect(headerButtonFor("/roles/", nobody)).toBeUndefined();
    expect(headerButtonFor("/roles/", admin)?.action).toBe("add-role");
  });
});

describe("menuForUser", () => {
  it("drops a group whose children are all refused", () => {
    const labels = menuForUser(nobody).map((item) => item.label);
    expect(labels).toContain("Dashboard");
    expect(labels).not.toContain("Invoices");
    expect(labels).not.toContain("Reports");
  });

  it("shows a non-Admin only Sessions under Users", () => {
    const users = menuForUser(nobody).find((item) => item.label === "Users");
    expect(users?.children?.map((child) => child.label)).toEqual(["Sessions"]);
  });
});
