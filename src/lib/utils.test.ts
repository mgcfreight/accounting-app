import { describe, expect, it } from "vitest";
import { torontoLocalToIso } from "./utils";

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
