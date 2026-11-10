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

// The file's name. A period still running says so, with the day it runs to,
// so a part month is never mistaken for a whole one.
export const accountantExportFileName = (
  period: string,
  toDate: string | null
) => `accountant-export-${period}${toDate ? `-to-${toDate}` : ""}.csv`;

// What the card tells the user before they download: a partial file and a
// running period, each in a sentence. Null when there is nothing to say.
export const accountantExportNote = (
  access: AccountantExportAccess,
  toDate: string | null
): string | null => {
  const notes = [
    access.leftOut.length > 0 &&
      `Your role can't see ${access.leftOut.join(", ")}, so the file leaves them out: it is not the full books for the period.`,
    toDate &&
      `The period is still running: the file covers it only up to ${toDate}.`,
  ].filter(Boolean);
  return notes.length ? notes.join(" ") : null;
};
