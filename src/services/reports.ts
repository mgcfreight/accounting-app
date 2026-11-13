import { apiClient, getFile, parseBody } from "./api-client";
import {
  envelope,
  fxGainLossReportSchema,
  monthlyPnlReportSchema,
  paginated,
  partyAgingReportSchema,
  partyPnlReportSchema,
  reportSummarySchema,
  shipmentPnlSchema,
  taxReportSchema,
} from "./schemas";

// Financial reports (/report), CAD, read straight from invoices and
// payments. Needs reports.view; an Excel export reports.export_csv too, a
// PDF reports.export_pdf. `period` is a month (2026-10), a quarter
// (2026-Q3), a year (2026) or a year to date (2026-YTD), never in the future.

export type ReportFormat = "pdf" | "xlsx";

// The reports with an export, by their path.
export type ReportKind =
  | "summary"
  | "pnl/monthly"
  | "pnl/party"
  | "pnl/shipment"
  | "aging/party"
  | "tax"
  | "fx";

// Revenue, carrier cost, margin, GST/HST, money in and out, bad debts and
// exchange gain or loss, with what was left out for want of a rate.
export const getReportSummary = (period: string, signal?: AbortSignal) =>
  apiClient
    .get("/report/summary", { params: { period }, signal })
    .then((res) => parseBody(envelope(reportSummarySchema), res.data).data);

// Revenue, carrier cost and gross margin for each month of the period, and
// its total.
export const getMonthlyPnl = (period: string, signal?: AbortSignal) =>
  apiClient
    .get("/report/pnl/monthly", { params: { period }, signal })
    .then((res) => parseBody(envelope(monthlyPnlReportSchema), res.data).data);

export const getPartyPnl = (period: string, signal?: AbortSignal) =>
  apiClient
    .get("/report/pnl/party", { params: { period }, signal })
    .then((res) => parseBody(envelope(partyPnlReportSchema), res.data).data);

// Biggest revenue first.
export const listShipmentPnl = (
  params: { period: string; page: number; limit: number },
  signal?: AbortSignal
) =>
  apiClient
    .get("/report/pnl/shipment", { params, signal })
    .then(
      (res) => parseBody(envelope(paginated(shipmentPnlSchema)), res.data).data
    );

// As of today; not tied to a period.
export const getPartyAging = (signal?: AbortSignal) =>
  apiClient
    .get("/report/aging/party", { signal })
    .then((res) => parseBody(envelope(partyAgingReportSchema), res.data).data);

// GST/HST collected against input tax credits and bad-debt relief.
export const getTaxReport = (period: string, signal?: AbortSignal) =>
  apiClient
    .get("/report/tax", { params: { period }, signal })
    .then((res) => parseBody(envelope(taxReportSchema), res.data).data);

// Realized exchange gain and loss on USD payments allocated in the period.
export const getFxGainLoss = (period: string, signal?: AbortSignal) =>
  apiClient
    .get("/report/fx", { params: { period }, signal })
    .then((res) => parseBody(envelope(fxGainLossReportSchema), res.data).data);

// A report as Excel or PDF, made by the API. Aging per party has no period.
export const exportReport = (
  kind: ReportKind,
  period: string,
  format: ReportFormat,
  fallbackName: string
) =>
  getFile(
    `/report/${kind}/export`,
    kind === "aging/party" ? { format } : { period, format },
    fallbackName
  );
