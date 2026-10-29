import { describe, expect, it } from "vitest";
import { Currency, PartyType } from "@/lib/enums";
import agingParty from "./__fixtures__/reports/aging-party.json";
import fx from "./__fixtures__/reports/fx.json";
import pnlParty from "./__fixtures__/reports/pnl-party.json";
import pnlShipment from "./__fixtures__/reports/pnl-shipment.json";
import summary from "./__fixtures__/reports/summary.json";
import tax from "./__fixtures__/reports/tax.json";
import {
  envelope,
  fxGainLossReportSchema,
  paginated,
  partyAgingReportSchema,
  partyPnlReportSchema,
  reportSummarySchema,
  shipmentPnlSchema,
  taxReportSchema,
} from "./schemas";

// Real responses from the Accounts API (mgcfreight/accounting
// feature/25-billing-notices) for 2026 year to date over the local demo
// data, captured over HTTP as an Admin.

describe("report schemas on real responses", () => {
  it("reads the summary, with bad debts and what was left out", () => {
    const { data } = envelope(reportSummarySchema).parse(summary);
    expect(data.period.key).toBe("2026-YTD");
    expect(data.period.toDate).toBe(true);
    expect(data.badDebts).toMatch(/^\d+\.\d{2}$/);
    expect(data.leftOutNoRate.shipperInvoices).toBe(0);
  });

  it("reads P&L by party and by shipment", () => {
    const party = envelope(partyPnlReportSchema).parse(pnlParty).data;
    expect(party.shippers.every((row) => row.type === PartyType.Shipper)).toBe(true);
    expect(party.carriers.length).toBeGreaterThan(0);
    const shipments = envelope(paginated(shipmentPnlSchema)).parse(pnlShipment).data;
    expect(shipments.items.length).toBeGreaterThan(0);
  });

  it("reads the aging per party, as of a date", () => {
    const { data } = envelope(partyAgingReportSchema).parse(agingParty);
    expect(data.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(data.receivable.some((row) => row.currency === Currency.USD)).toBe(true);
  });

  it("reads the tax report with its totals", () => {
    const { data } = envelope(taxReportSchema).parse(tax);
    expect(data.rows.length).toBeGreaterThan(0);
    expect(data.totals.netTax).toMatch(/^-?\d+\.\d{2}$/);
  });

  it("reads the exchange gain and loss", () => {
    const { data } = envelope(fxGainLossReportSchema).parse(fx);
    expect(data.rows[0].currency).toBe(Currency.USD);
    expect(data.totals.net).toMatch(/^-?\d+\.\d{2}$/);
  });

  it("refuses a summary figure sent as a number", () => {
    const bad = { ...summary, data: { ...summary.data, badDebts: 142.86 } };
    expect(() => envelope(reportSummarySchema).parse(bad)).toThrow();
  });
});
