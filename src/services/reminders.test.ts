import { describe, expect, it } from "vitest";
import {
  InvoiceDirection,
  ReminderKind,
  ReminderSkipReason,
  ReminderStatus,
} from "@/lib/enums";
import all from "./__fixtures__/reminders/all.json";
import counts from "./__fixtures__/reminders/counts.json";
import {
  envelope,
  paginated,
  reminderCountsSchema,
  reminderSchema,
} from "./schemas";

// Real responses from the Accounts API (mgcfreight/accounting
// feature/25-billing-notices) over the local demo data, captured over HTTP
// as an Admin, so both sides are listed.

describe("reminder schemas on real responses", () => {
  it("reads reminders on both sides, before due and overdue", () => {
    const { data } = envelope(paginated(reminderSchema)).parse(all);
    const directions = new Set(data.items.map((r) => r.direction));
    expect(directions).toEqual(
      new Set([InvoiceDirection.Receivable, InvoiceDirection.Payable])
    );
    const kinds = new Set(data.items.map((r) => r.kind));
    expect(kinds.has(ReminderKind.BeforeDue)).toBe(true);
    expect(kinds.has(ReminderKind.Overdue)).toBe(true);
  });

  it("reads a skipped reminder with its reason", () => {
    const { data } = envelope(paginated(reminderSchema)).parse(all);
    const skipped = data.items.find((r) => r.status === ReminderStatus.Skipped);
    expect(skipped?.skipReason).toBe(ReminderSkipReason.RemindersOff);
    expect(skipped?.sentAt).toBeNull();
  });

  it("reads the counts", () => {
    const { data } = envelope(reminderCountsSchema).parse(counts);
    expect(data.scheduled).toBeGreaterThan(0);
  });

  it("refuses an unknown reminder status", () => {
    const bad = {
      ...all,
      data: {
        ...all.data,
        items: [{ ...all.data.items[0], status: "CANCELLED" }],
      },
    };
    expect(() => envelope(paginated(reminderSchema)).parse(bad)).toThrow();
  });
});
