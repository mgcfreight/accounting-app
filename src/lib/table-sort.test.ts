import { describe, expect, it } from "vitest";
import { sortTableRows } from "./table-sort";
import type { BaseTableColumn } from "./types";

const balance: BaseTableColumn = { key: "balance", label: "Balance", sortType: "money" };

const rows = [
  { id: "a", currency: "USD", balance: "10000.00" },
  { id: "b", currency: "CAD", balance: "9000.00" },
  { id: "c", currency: "CAD", balance: "10000.00" },
  { id: "d", currency: "USD", balance: "50.00" },
];

const ids = (sorted: typeof rows) => sorted.map((row) => row.id);

describe("sortTableRows, money", () => {
  it("groups by currency, then sorts amounts within each", () => {
    expect(ids(sortTableRows(rows, balance, "asc"))).toEqual(["b", "c", "d", "a"]);
    expect(ids(sortTableRows(rows, balance, "desc"))).toEqual(["c", "b", "a", "d"]);
  });

  it("reads the currency from currencyKey when set", () => {
    const other = rows.map(({ currency, ...row }) => ({ ...row, cur: currency }));
    const sorted = sortTableRows(other, { ...balance, currencyKey: "cur" }, "asc");
    expect(sorted.map((row) => row.id)).toEqual(["b", "c", "d", "a"]);
  });

  it("sorts by amount alone when rows carry no currency", () => {
    const plain = rows.map(({ id, balance: amount }) => ({ id, balance: amount }));
    expect(sortTableRows(plain, balance, "asc").map((row) => row.id)).toEqual(["d", "b", "a", "c"]);
  });

  it("puts rows without a currency in their own group, last", () => {
    const mixed = [
      { id: "none-100", balance: "100.00" },
      { id: "usd-50", currency: "USD", balance: "50.00" },
      { id: "cad-200", currency: "CAD", balance: "200.00" },
      { id: "none-20", balance: "20.00" },
    ];
    const order = (direction: "asc" | "desc") =>
      sortTableRows(mixed, balance, direction).map((row) => row.id);
    expect(order("asc")).toEqual(["cad-200", "usd-50", "none-20", "none-100"]);
    expect(order("desc")).toEqual(["cad-200", "usd-50", "none-100", "none-20"]);
    // The order mustn't depend on where the rows started.
    const reversed = sortTableRows([...mixed].reverse(), balance, "asc");
    expect(reversed.map((row) => row.id)).toEqual(order("asc"));
  });
});
