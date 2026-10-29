import { describe, expect, it } from "vitest";
import {
  EmailStatus,
  PartyType,
  StatementRunTrigger,
  StatementTrigger,
} from "@/lib/enums";
import current from "./__fixtures__/statements/current.json";
import history from "./__fixtures__/statements/history.json";
import runs from "./__fixtures__/statements/runs.json";
import schedule from "./__fixtures__/statements/schedule.json";
import sendWeekly from "./__fixtures__/statements/send-weekly.json";
import statement from "./__fixtures__/statements/statement.json";
import {
  envelope,
  paginated,
  statementHistoryItemSchema,
  statementRunSchema,
  statementScheduleSchema,
  statementSchema,
} from "./schemas";

// Real responses from the Accounts API (mgcfreight/accounting
// feature/25-billing-notices) over the local demo data, captured over HTTP
// as an Admin. Email is off there, so statements are saved as QUEUED.

describe("statement schemas on real responses", () => {
  it("reads the schedule", () => {
    const { data } = envelope(statementScheduleSchema).parse(schedule);
    expect(data.emailEnabled).toBe(false);
    expect(data.weeklyShipperCount).toBeGreaterThan(0);
  });

  it("reads weekly runs, and the run Send now returns", () => {
    const { data } = envelope(paginated(statementRunSchema)).parse(runs);
    expect(data.items.length).toBeGreaterThan(0);
    const run = envelope(statementRunSchema).parse(sendWeekly).data;
    expect(run.trigger).toBe(StatementRunTrigger.Manual);
    expect(run.queuedCount).toBe(run.partyCount);
  });

  it("reads the current statement: not saved, so no number", () => {
    const { data } = envelope(statementSchema).parse(current);
    expect(data.number).toBeNull();
    expect(data.statementId).toBeNull();
    expect(data.partyType).toBe(PartyType.Shipper);
    expect(data.lines.length).toBeGreaterThan(0);
    expect(data.closingBalance).toMatch(/^-?\d+\.\d{2}$/);
  });

  it("reads a saved statement and the party's history", () => {
    const saved = envelope(statementSchema).parse(statement).data;
    expect(saved.number).toMatch(/^ST-\d+$/);
    expect(saved.emailStatus).toBe(EmailStatus.Queued);
    const { data } = envelope(paginated(statementHistoryItemSchema)).parse(history);
    expect(data.items[0].statementId).toBe(saved.statementId);
    // Made by Send now.
    expect(data.items[0].trigger).toBe(StatementTrigger.Manual);
  });

  it("refuses a statement amount sent as a number", () => {
    const bad = {
      ...current,
      data: { ...current.data, closingBalance: 12.5 },
    };
    expect(() => envelope(statementSchema).parse(bad)).toThrow();
  });
});
