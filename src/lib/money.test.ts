import { describe, expect, it } from "vitest";
import { sumMoney } from "./money";

// The allocation form checks its amounts add up to no more than the payment
// with this, so it must be exact to the cent.
describe("sumMoney", () => {
  it("adds without float error", () => {
    expect(sumMoney(["0.10", "0.20"])).toBe("0.30");
    expect(sumMoney(["1000.00", "1000.00"])).toBe("2000.00");
    expect(sumMoney(["999999999.99", "0.01"])).toBe("1000000000.00");
  });

  it("returns 0.00 for no amounts", () => {
    expect(sumMoney([])).toBe("0.00");
  });

  it("keeps the leading zero below one", () => {
    expect(sumMoney(["0.01", "0.04"])).toBe("0.05");
  });

  it("handles negative amounts", () => {
    expect(sumMoney(["5.00", "-7.25"])).toBe("-2.25");
    expect(sumMoney(["-0.50", "0.50"])).toBe("0.00");
  });

  it("returns null for a malformed amount rather than skipping it", () => {
    expect(sumMoney(["100.00", "50"])).toBeNull();
    expect(sumMoney(["100.00", "1,000.00"])).toBeNull();
    expect(sumMoney(["abc"])).toBeNull();
  });
});
