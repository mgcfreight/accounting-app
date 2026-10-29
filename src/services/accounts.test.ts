import { describe, expect, it } from "vitest";
import { Currency, PartyType } from "@/lib/enums";
import aging from "./__fixtures__/accounts/aging.json";
import dashboard from "./__fixtures__/accounts/dashboard.json";
import pnlMonthly from "./__fixtures__/accounts/pnl-monthly.json";
import summaries from "./__fixtures__/accounts/summaries.json";
import {
  accountSummarySchema,
  agingSchema,
  dashboardSchema,
  envelope,
  monthlyPnlReportSchema,
  paginated,
} from "./schemas";

// Real responses from the Accounts API (mgcfreight/accounting
// feature/25-billing-notices) over the local demo data, captured over HTTP
// as an Admin, so every section is present.

describe("account and report schemas on real responses", () => {
  it("reads the dashboard: amounts per currency, counts per side", () => {
    const { data } = envelope(dashboardSchema).parse(dashboard);
    expect(Object.keys(data.receivable ?? {})).toEqual([Currency.CAD, Currency.USD]);
    expect(typeof data.overdueCount.shipper).toBe("number");
    expect(typeof data.needsReview).toBe("number");
  });

  it("reads the aging, receivable and payable rows per currency", () => {
    const { data } = envelope(agingSchema).parse(aging);
    expect(data.receivable?.map((row) => row.currency)).toEqual([
      Currency.CAD,
      Currency.USD,
    ]);
    expect(data.payable).not.toBeNull();
  });

  it("reads party account summaries", () => {
    const { data } = envelope(paginated(accountSummarySchema)).parse(summaries);
    expect(data.items.length).toBeGreaterThan(0);
    expect(data.items.every((row) => row.type === PartyType.Shipper)).toBe(true);
  });

  it("reads the monthly P&L, a row per month and the total", () => {
    const { data } = envelope(monthlyPnlReportSchema).parse(pnlMonthly);
    expect(data.period.key).toBe("2026-YTD");
    expect(data.months.length).toBeGreaterThan(0);
    expect(data.total.revenue).toMatch(/^-?\d+\.\d{2}$/);
  });

  it("refuses a hidden side sent as a number instead of null", () => {
    const bad = {
      ...dashboard,
      data: { ...dashboard.data, receivable: 0 },
    };
    expect(() => envelope(dashboardSchema).parse(bad)).toThrow();
  });
});
