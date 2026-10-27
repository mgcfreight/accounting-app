import { toast } from "sonner";
import { Currency } from "@/lib/enums";
import { downloadCsv, ExportTable, printTable } from "@/lib/export";
import { formatMoney } from "@/lib/money";

export type ExportFormat = "Excel" | "PDF" | "CSV";

// An amount as exported text, with its currency. A malformed amount is a
// dash, never "0.00", as on screen.
export const moneyText = (amount: string, currency: Currency) =>
  formatMoney(amount, currency) ?? "—";

// Excel and CSV download the same CSV file, which Excel opens; PDF opens the
// print view, where the browser saves it as a PDF.
export const exportTable = <T>(table: ExportTable<T>, format: ExportFormat) => {
  if (format === "PDF") {
    if (!printTable(table)) {
      toast.error("The print view was blocked. Allow pop-ups for this site and try again.");
    }
    return;
  }
  downloadCsv(table);
};
