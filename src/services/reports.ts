import { apiClient, parseBody } from "./api-client";
import { envelope, monthlyPnlReportSchema } from "./schemas";

// Financial reports (/report), CAD, read straight from invoices and
// payments. Needs reports.view. `period` is a month (2026-10), a quarter
// (2026-Q3), a year (2026) or a year to date (2026-YTD), never in the future.

// Revenue, carrier cost and gross margin for each month of the period, and
// its total.
export const getMonthlyPnl = (period: string, signal?: AbortSignal) =>
  apiClient
    .get("/report/pnl/monthly", { params: { period }, signal })
    .then((res) => parseBody(envelope(monthlyPnlReportSchema), res.data).data);
