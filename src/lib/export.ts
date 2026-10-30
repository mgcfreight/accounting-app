// Exports of a table as the screen shows it: a CSV file that Excel opens,
// and a print view the browser saves as PDF. A stopgap until the API
// generates the reports (design §10: ExcelJS / pdfmake); the screens running
// on mock data export the mock figures, labelled as such.
//
// Every value is text already formatted for reading (amounts from
// formatMoney, dates from formatDate); nothing is calculated here.

export type ExportColumn<T> = {
  label: string;
  value: (row: T) => string;
};

export type ExportTable<T> = {
  title: string;
  // Printed under the title: the period, "Demo data", ...
  subtitle?: string;
  columns: ExportColumn<T>[];
  rows: T[];
};

// A cell starting with = + - @ (or a tab or carriage return) is run as a
// formula by Excel. Prefixed with an apostrophe it stays text, so a negative
// amount ("-CAD 12.00") exports as "'-CAD 12.00".
const FORMULA_START = /^[=+\-@\t\r]/;

const csvCell = (value: string) => {
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, "\"\"")}"` : safe;
};

export const toCsv = <T>({ columns, rows }: ExportTable<T>): string =>
  [
    columns.map((column) => csvCell(column.label)).join(","),
    ...rows.map((row) =>
      columns.map((column) => csvCell(column.value(row))).join(",")
    ),
  ].join("\r\n");

// "P&L by Shipper" -> "pnl-by-shipper".
export const exportFileName = (title: string, extension: string) =>
  `${
    title
      .toLowerCase()
      .replace(/&/g, "n")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "export"
  }.${extension}`;

export const downloadCsv = <T>(table: ExportTable<T>) => {
  // The byte-order mark makes Excel read the file as UTF-8 (é, –).
  const blob = new Blob(["﻿", toCsv(table)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = exportFileName(table.title, "csv");
  link.click();
  URL.revokeObjectURL(url);
};

export const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// The page the print view writes. Every value is escaped, so a party name
// from the TMS can't add markup or script to it.
export const toPrintHtml = <T>({
  title,
  subtitle,
  columns,
  rows,
}: ExportTable<T>): string => `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
body{font-family:Lato,Arial,sans-serif;color:#1f2937;margin:24px}
h1{font-size:20px;margin:0 0 4px}p{margin:0 0 16px;color:#6b7280;font-size:12px}
table{border-collapse:collapse;width:100%;font-size:11px}
th,td{border-bottom:1px solid #e5e7eb;padding:6px 8px;text-align:left}
th{background:#f3f4f6}
</style></head><body>
<h1>${escapeHtml(title)}</h1>${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ""}
<table><thead><tr>${columns
  .map((column) => `<th>${escapeHtml(column.label)}</th>`)
  .join("")}</tr></thead><tbody>${rows
  .map(
    (row) =>
      `<tr>${columns
        .map((column) => `<td>${escapeHtml(column.value(row))}</td>`)
        .join("")}</tr>`
  )
  .join("")}</tbody></table></body></html>`;

// Opens an empty window for a print view. Call it in the click itself: a
// pop-up blocker allows a window opened there, not one opened after a fetch.
// Returns null when the window was blocked.
export const openPrintWindow = (): Window | null => {
  const view = window.open("", "_blank");
  if (!view) return null;
  view.opener = null;
  view.document.write(
    "<p style=\"font-family:Lato,Arial,sans-serif;margin:24px\">Preparing…</p>"
  );
  return view;
};

// Writes the page into the window and opens the browser's print dialog,
// where "Save as PDF" makes the file.
export const printInto = (view: Window, html: string) => {
  view.document.open();
  view.document.write(html);
  view.document.close();
  view.focus();
  view.print();
};

// Opens the print view of a table. Returns false when a pop-up blocker
// stopped the window, so the caller can say so.
export const printTable = <T>(table: ExportTable<T>): boolean => {
  const view = openPrintWindow();
  if (!view) return false;
  printInto(view, toPrintHtml(table));
  return true;
};
