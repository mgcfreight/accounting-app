import { describe, expect, it } from "vitest";
import { Permission } from "@/lib/enums";
import {
  accountantExportAccess,
  accountantExportFileName,
  accountantExportNote,
  periodMonths,
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
  it("names an ended period as it is", () => {
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

  it("says nothing for a complete file of an ended period", () => {
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

describe("an ended period not yet closed (accounts, 13 Nov 2026)", () => {
  const complete = { canExport: true, leftOut: [] };

  it("names its file open, as the API does", () => {
    expect(accountantExportFileName("2026-10", null, true)).toBe(
      "accountant-export-2026-10-open.csv"
    );
    // A running period says how far it goes instead.
    expect(accountantExportFileName("2026-11", "2026-11-13", true)).toBe(
      "accountant-export-2026-11-to-2026-11-13.csv"
    );
  });

  it("warns that its file may change", () => {
    expect(accountantExportNote(complete, null, ["2026-10"])).toBe(
      "2026-10 isn't closed yet: a late bill, invoice or payment can still be dated in it, so this file may change. Export again once it is closed."
    );
    expect(accountantExportNote(complete, null, [])).toBeNull();
  });

  it("lists the months a period covers, up to today's", () => {
    expect(periodMonths("2026-10", "2026-11-13")).toEqual(["2026-10"]);
    expect(periodMonths("2026-Q4", "2026-11-13")).toEqual(["2026-10", "2026-11"]);
    expect(periodMonths("2026-YTD", "2026-02-02")).toEqual(["2026-01", "2026-02"]);
    expect(periodMonths("2025", "2026-11-13")).toHaveLength(12);
  });
});
