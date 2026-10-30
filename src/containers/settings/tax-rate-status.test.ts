import { describe, expect, it } from "vitest";
import { taxRateStatus } from "./tax-rate-status";

const today = "2026-10-30";

describe("taxRateStatus", () => {
  it("keeps the rate in force current after a future rate ends it", () => {
    // HST-ON 13% ended the day before 15% from 2027-01-01.
    expect(taxRateStatus({ effectiveFrom: "2025-07-01", effectiveTo: "2026-12-31" }, today)).toBe("current");
    expect(taxRateStatus({ effectiveFrom: "2027-01-01", effectiveTo: null }, today)).toBe("scheduled");
  });

  it("treats an open rate that has started as current", () => {
    expect(taxRateStatus({ effectiveFrom: "2025-07-01", effectiveTo: null }, today)).toBe("current");
  });

  it("includes both the first and the last day", () => {
    expect(taxRateStatus({ effectiveFrom: today, effectiveTo: null }, today)).toBe("current");
    expect(taxRateStatus({ effectiveFrom: "2025-07-01", effectiveTo: today }, today)).toBe("current");
  });

  it("ends a rate the day after its last day", () => {
    expect(taxRateStatus({ effectiveFrom: "2025-07-01", effectiveTo: "2026-10-29" }, today)).toBe("ended");
  });

  it("schedules a rate starting tomorrow", () => {
    expect(taxRateStatus({ effectiveFrom: "2026-10-31", effectiveTo: null }, today)).toBe("scheduled");
  });
});
