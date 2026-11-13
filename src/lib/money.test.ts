import { describe, expect, it } from "vitest";
import { commissionPercent, compareMoney, sumMoney, toAmount } from "./money";

describe("compareMoney", () => {
  it("orders by value", () => {
    expect(compareMoney("10.00", "9.99")).toBeGreaterThan(0);
  });
});

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

// The revise form adds up its typed charge amounts with this, so a cent out
// here is a cent out on the commission shown.
describe("toAmount", () => {
  it("pads a typed amount to 2 decimals", () => {
    expect(toAmount("450")).toBe("450.00");
    expect(toAmount("450.5")).toBe("450.50");
    expect(toAmount("450.55")).toBe("450.55");
    expect(toAmount("0")).toBe("0.00");
    expect(toAmount("007.1")).toBe("7.10");
  });

  it("returns null for anything else", () => {
    expect(toAmount("450.555")).toBeNull();
    expect(toAmount("")).toBeNull();
    expect(toAmount("-5")).toBeNull();
    expect(toAmount("1,000")).toBeNull();
  });
});

describe("commissionPercent", () => {
  it("is the markup of the price over the cost", () => {
    expect(commissionPercent("400.00", "440")).toBe("10");
    expect(commissionPercent("400.00", "450.00")).toBe("12.5");
    expect(commissionPercent("400.00", "400")).toBe("0");
  });

  it("rounds to 2 decimals, half up", () => {
    // 50 / 333.33 = 15.0001…%
    expect(commissionPercent("333.33", "383.33")).toBe("15");
    // 1 / 3 = 33.333…%
    expect(commissionPercent("3.00", "4")).toBe("33.33");
    // 2 / 3 = 66.666…%
    expect(commissionPercent("3.00", "5")).toBe("66.67");
  });

  it("is negative below the cost", () => {
    expect(commissionPercent("400.00", "360")).toBe("-10");
  });

  it("takes a base price as typed", () => {
    expect(commissionPercent("400", "440")).toBe("10");
  });

  it("returns null for a zero base or a malformed one or price", () => {
    expect(commissionPercent("0.00", "10")).toBeNull();
    expect(commissionPercent("0", "10")).toBeNull();
    expect(commissionPercent("400.00", "")).toBeNull();
    expect(commissionPercent("400.00", "1.23456")).toBeNull();
    expect(commissionPercent("400.123", "440")).toBeNull();
  });
});
