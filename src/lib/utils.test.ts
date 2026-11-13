import { describe, expect, it } from "vitest";
import { addDays, addMonths, daysPastDue, torontoLocalToIso } from "./utils";

describe("addMonths", () => {
  it("moves a date by whole months, across a year end", () => {
    expect(addMonths("2026-11-12", 12)).toBe("2027-11-12");
    expect(addMonths("2026-11-30", 2)).toBe("2027-01-30");
  });

  it("keeps to the end of a shorter month, as the API does", () => {
    expect(addMonths("2028-02-29", 12)).toBe("2029-02-28");
    expect(addMonths("2027-01-31", 1)).toBe("2027-02-28");
  });
});

// The shipment form sends "Created in TMS" through this; the API takes the
// Toronto date of the result as the invoice date, which picks the tax rate.
describe("torontoLocalToIso", () => {
  it("reads summer times as EDT", () => {
    expect(torontoLocalToIso("2026-10-21T14:05")).toBe(
      "2026-10-21T14:05:00-04:00"
    );
  });

  it("reads winter times as EST", () => {
    expect(torontoLocalToIso("2026-12-01T09:00")).toBe(
      "2026-12-01T09:00:00-05:00"
    );
  });

  it("keeps a late-evening time on its own Toronto date", () => {
    expect(torontoLocalToIso("2026-01-15T23:30")).toBe(
      "2026-01-15T23:30:00-05:00"
    );
  });

  it("uses the offset in force on either side of the autumn change", () => {
    // Clocks go back at 02:00 EDT on 1 November 2026.
    expect(torontoLocalToIso("2026-11-01T00:30")).toBe(
      "2026-11-01T00:30:00-04:00"
    );
    expect(torontoLocalToIso("2026-11-01T03:00")).toBe(
      "2026-11-01T03:00:00-05:00"
    );
  });

  it("uses the offset in force after the spring change", () => {
    // Clocks go forward at 02:00 EST on 8 March 2026.
    expect(torontoLocalToIso("2026-03-08T01:30")).toBe(
      "2026-03-08T01:30:00-05:00"
    );
    expect(torontoLocalToIso("2026-03-08T03:30")).toBe(
      "2026-03-08T03:30:00-04:00"
    );
  });
});

describe("daysPastDue", () => {
  it("is 0 on and before the due date", () => {
    expect(daysPastDue("2026-10-14", "2026-10-14")).toBe(0);
    expect(daysPastDue("2026-10-14", "2026-10-01")).toBe(0);
  });

  it("counts whole days after it, across a DST change", () => {
    expect(daysPastDue("2026-10-14", "2026-10-19")).toBe(5);
    expect(daysPastDue("2026-10-25", "2026-11-04")).toBe(10);
  });
});

describe("addDays", () => {
  it("moves a calendar date across months and years", () => {
    expect(addDays("2026-10-31", -7)).toBe("2026-10-24");
    expect(addDays("2026-03-03", -7)).toBe("2026-02-24");
    expect(addDays("2027-01-05", -7)).toBe("2026-12-29");
  });

  it("is not shifted by the autumn clock change", () => {
    expect(addDays("2026-11-05", -7)).toBe("2026-10-29");
  });
});
