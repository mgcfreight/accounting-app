import { Permission } from "@/lib/enums";

// The accountant export's sections, and the view each needs. The API leaves
// out every section the role may not view (accounting#79), so the file is
// only complete for a role that may view them all.
const SECTIONS: { label: string; permission: Permission }[] = [
  { label: "shipper invoices", permission: Permission.CustomerInvoicesView },
  { label: "carrier invoices", permission: Permission.CarrierInvoicesView },
  { label: "shipper payments", permission: Permission.CustomerPaymentsView },
  { label: "carrier payments", permission: Permission.CarrierPaymentsView },
];

export type AccountantExportAccess = {
  // Whether the CSV button shows: reports.export_csv and at least one section.
  canExport: boolean;
  // The sections the file will leave out for this role; empty when complete.
  leftOut: string[];
};

export const accountantExportAccess = (
  can: (permission: Permission) => boolean
): AccountantExportAccess => {
  const leftOut = SECTIONS.filter((section) => !can(section.permission)).map(
    (section) => section.label
  );
  return {
    canExport:
      can(Permission.ReportsExportCsv) && leftOut.length < SECTIONS.length,
    leftOut,
  };
};

// The months ("YYYY-MM") a period key covers, up to today's month: a month
// ("2026-10"), a quarter ("2026-Q4"), the year to date ("2026-YTD") or a
// year ("2025"), as the API reads them.
export const periodMonths = (period: string, today: string): string[] => {
  const [yearText, rest = ""] = period.split("-");
  const year = Number(yearText);
  const [first, last] = /^\d{2}$/.test(rest)
    ? [Number(rest), Number(rest)]
    : rest.startsWith("Q")
      ? [Number(rest.slice(1)) * 3 - 2, Number(rest.slice(1)) * 3]
      : [1, 12];
  const months: string[] = [];
  for (let m = first; m <= last; m += 1) {
    const month = `${year}-${String(m).padStart(2, "0")}`;
    if (month <= today.slice(0, 7)) months.push(month);
  }
  return months;
};

// The file's name, as the API names it (accounting#79): a period still
// running says the day it runs to, so a part month is never mistaken for a
// whole one; one that has ended with a month not yet closed says it is
// open, as its file can still change.
export const accountantExportFileName = (
  period: string,
  toDate: string | null,
  open = false
) =>
  `accountant-export-${period}${toDate ? `-to-${toDate}` : open ? "-open" : ""}.csv`;

// What the card tells the user before they download: a partial file, a
// running period and an ended one not yet closed, each in a sentence. Null
// when there is nothing to say.
export const accountantExportNote = (
  access: AccountantExportAccess,
  toDate: string | null,
  openMonths: string[] = []
): string | null => {
  const notes = [
    access.leftOut.length > 0 &&
      `Your role can't see ${access.leftOut.join(", ")}, so the file leaves them out: it is not the full books for the period.`,
    toDate &&
      `The period is still running: the file covers it only up to ${toDate}.`,
    // Accounts, 13 Nov 2026: allowed, with a clear warning.
    !toDate &&
      openMonths.length > 0 &&
      `${openMonths.join(", ")} ${openMonths.length === 1 ? "isn't" : "aren't"} closed yet: a late bill, invoice or payment can still be dated in ${openMonths.length === 1 ? "it" : "them"}, so this file may change. Export again once ${openMonths.length === 1 ? "it is" : "they are"} closed.`,
  ].filter(Boolean);
  return notes.length ? notes.join(" ") : null;
};
