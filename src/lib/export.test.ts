import { describe, expect, it } from "vitest";
import { exportFileName, toCsv, toPrintHtml } from "./export";

type Row = { name: string; amount: string };

const table = (rows: Row[]) => ({
  title: "P&L by Shipper",
  subtitle: "October 2026",
  columns: [
    { label: "Name", value: (row: Row) => row.name },
    { label: "Amount", value: (row: Row) => row.amount },
  ],
  rows,
});

describe("toCsv", () => {
  it("writes a header and one line per row", () => {
    expect(toCsv(table([{ name: "Day & Ross", amount: "CAD 1,920.00" }]))).toBe(
      "Name,Amount\r\nDay & Ross,\"CAD 1,920.00\""
    );
  });

  it("quotes commas, quotes and line breaks", () => {
    expect(toCsv(table([{ name: "A \"B\", C\nD", amount: "x" }]))).toBe(
      "Name,Amount\r\n\"A \"\"B\"\", C\nD\",x"
    );
  });

  it("keeps a value that looks like a formula as text", () => {
    const csv = toCsv(
      table([
        { name: "=HYPERLINK(\"http://x\")", amount: "+1" },
        { name: "@SUM(A1)", amount: "-2" },
      ])
    );
    expect(csv).toContain("\"'=HYPERLINK(\"\"http://x\"\")\",'+1");
    expect(csv).toContain("'@SUM(A1),'-2");
  });
});

describe("toPrintHtml", () => {
  it("escapes every value", () => {
    const html = toPrintHtml(
      table([{ name: "<img src=x onerror=alert(1)>", amount: "CAD 1.00" }])
    );
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("<title>P&amp;L by Shipper</title>");
  });
});

describe("exportFileName", () => {
  it("makes a plain file name from a title", () => {
    expect(exportFileName("P&L by Shipper / Carrier", "csv")).toBe(
      "pnl-by-shipper-carrier.csv"
    );
    expect(exportFileName("***", "csv")).toBe("export.csv");
  });
});
