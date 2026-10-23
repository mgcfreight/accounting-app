import { describe, expect, it } from "vitest";
import { Permission, SystemRoleId } from "@/lib/enums";
import { meSchema, permissionCatalogSchema, userSchema } from "./schemas";

// GET /auth/me as mgc-accounts-backend 6d4374d sends it.
const me = {
  id: "usr_VIEWER0001",
  firstName: "Sam",
  lastName: "Lee",
  email: "sam@mgcfreight.com",
  role: { id: SystemRoleId.Viewer, name: "Viewer", isSystem: true },
  isAdmin: false,
  permissions: ["parties.view", "customer_invoices.view"],
  isEnabled: true,
  twoFactorEnabled: true,
  lastLoginAt: "2026-10-24T09:30:00.000Z",
  createdAt: "2026-10-01T09:30:00.000Z",
  updatedAt: "2026-10-01T09:30:00.000Z",
  recoveryCodesRemaining: 9,
  twoFactor: {
    authenticatorSetUp: true,
    canTurnOff: true,
    availableMethods: ["TOTP"],
  },
};

describe("meSchema", () => {
  it("reads the role object, isAdmin and permissions", () => {
    const parsed = meSchema.parse(me);
    expect(parsed.role.id).toBe(SystemRoleId.Viewer);
    expect(parsed.isAdmin).toBe(false);
    expect(parsed.permissions).toEqual([
      Permission.PartiesView,
      Permission.CustomerInvoicesView,
    ]);
  });

  it("drops a permission this build doesn't know instead of failing", () => {
    const parsed = meSchema.parse({
      ...me,
      permissions: ["parties.view", "sync.run"],
    });
    expect(parsed.permissions).toEqual([Permission.PartiesView]);
  });

  it("refuses the old string role", () => {
    expect(meSchema.safeParse({ ...me, role: "Viewer" }).success).toBe(false);
  });

  it("refuses a response without isAdmin", () => {
    const { isAdmin: _isAdmin, ...withoutIsAdmin } = me;
    expect(meSchema.safeParse(withoutIsAdmin).success).toBe(false);
  });
});

describe("userSchema", () => {
  it("reads a user row's role object", () => {
    const {
      isAdmin: _isAdmin,
      permissions: _permissions,
      recoveryCodesRemaining: _codes,
      twoFactor: _twoFactor,
      ...user
    } = me;
    expect(userSchema.parse(user).role.name).toBe("Viewer");
  });
});

describe("permissionCatalogSchema", () => {
  it("keeps known cells and drops unknown ones", () => {
    const parsed = permissionCatalogSchema.parse({
      modules: [
        {
          module: "parties",
          label: "Customers and carriers",
          description: "Parties and their agreed terms",
          actions: [
            { action: "view", label: "View", permission: "parties.view" },
            { action: "archive", label: "Archive", permission: "parties.archive" },
          ],
        },
      ],
      actions: [{ action: "view", label: "View" }],
    });
    expect(parsed.modules[0].actions.map((cell) => cell.permission)).toEqual([
      Permission.PartiesView,
    ]);
  });
});
