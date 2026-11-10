import { describe, expect, it } from "vitest";
import { Permission } from "@/lib/enums";
import {
  accountantExportAccess,
  accountantExportFileName,
  accountantExportNote,
} from "./accountant-export";

const VIEWS = [
  Permission.CustomerInvoicesView,
  Permission.CarrierInvoicesView,
  Permission.CustomerPaymentsView,
  Permission.CarrierPaymentsView,
];

const role =
  (...permissions: Permission[]) =>
  (permission: Permission) =>
    permissions.includes(permission);

describe("accountantExportAccess", () => {
  it("is complete for a role that may view every section", () => {
    expect(
      accountantExportAccess(role(Permission.ReportsExportCsv, ...VIEWS))
    ).toEqual({ canExport: true, leftOut: [] });
  });

  it("names the sections a partial role's file leaves out", () => {
    expect(
      accountantExportAccess(
        role(Permission.ReportsExportCsv, Permission.CustomerInvoicesView)
      )
    ).toEqual({
      canExport: true,
      leftOut: ["carrier invoices", "shipper payments", "carrier payments"],
    });
  });

  it("hides the button without reports.export_csv", () => {
    expect(accountantExportAccess(role(...VIEWS)).canExport).toBe(false);
  });

  it("hides the button when the role may view no section (every click a 403)", () => {
    expect(
      accountantExportAccess(role(Permission.ReportsExportCsv)).canExport
    ).toBe(false);
  });
});

describe("accountantExportFileName", () => {
  it("names a closed period as it is", () => {
    expect(accountantExportFileName("2026-10", null)).toBe(
      "accountant-export-2026-10.csv"
    );
  });

  it("says how far a running period goes", () => {
    expect(accountantExportFileName("2026-11", "2026-11-10")).toBe(
      "accountant-export-2026-11-to-2026-11-10.csv"
    );
  });
});

describe("accountantExportNote", () => {
  const complete = { canExport: true, leftOut: [] };

  it("says nothing for a complete file of a closed period", () => {
    expect(accountantExportNote(complete, null)).toBeNull();
  });

  it("warns that a running period is only to date", () => {
    expect(accountantExportNote(complete, "2026-11-10")).toBe(
      "The period is still running: the file covers it only up to 2026-11-10."
    );
  });

  it("warns that a partial file is not the full books", () => {
    expect(
      accountantExportNote({ canExport: true, leftOut: ["carrier payments"] }, null)
    ).toContain("leaves them out: it is not the full books");
  });
});
