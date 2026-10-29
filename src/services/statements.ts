import { apiClient, getFile, parseBody } from "./api-client";
import {
  envelope,
  paginated,
  statementHistoryItemSchema,
  statementRunSchema,
  statementScheduleSchema,
  statementSchema,
} from "./schemas";

// Statements (/statement): a party's statement for the 7 days to today,
// the saved ones, the Friday run to weekly shippers, and their PDF and Excel
// copies. Reading a party's statement needs its side's invoice view
// permission; the schedule, the runs and every email need
// customer_invoices.view, and the emails reports.send_email too. Every
// figure is calculated by the API.

export type StatementFormat = "pdf" | "xlsx";

export type StatementHistoryParams = {
  partyId: string;
  page: number;
  // At most 100.
  limit: number;
};

// The next Friday run and how many shippers it will send to.
export const getStatementSchedule = (signal?: AbortSignal) =>
  apiClient
    .get("/statement/schedule", { signal })
    .then((res) => parseBody(envelope(statementScheduleSchema), res.data).data);

// Weekly runs, newest first.
export const listStatementRuns = (
  params: { page: number; limit: number },
  signal?: AbortSignal
) =>
  apiClient
    .get("/statement/runs", { params, signal })
    .then(
      (res) =>
        parseBody(envelope(paginated(statementRunSchema)), res.data).data
    );

// The party's statement for the 7 days to today, worked out now, not saved.
export const getCurrentStatement = (partyId: string, signal?: AbortSignal) =>
  apiClient
    .get("/statement/current", { params: { partyId }, signal })
    .then((res) => parseBody(envelope(statementSchema), res.data).data);

// The party's saved statements, newest first.
export const listStatementHistory = (
  params: StatementHistoryParams,
  signal?: AbortSignal
) =>
  apiClient
    .get("/statement/history", { params, signal })
    .then(
      (res) =>
        parseBody(envelope(paginated(statementHistoryItemSchema)), res.data)
          .data
    );

// A saved statement, as it was made.
export const getStatement = (statementId: string, signal?: AbortSignal) =>
  apiClient
    .get("/statement", { params: { statementId }, signal })
    .then((res) => parseBody(envelope(statementSchema), res.data).data);

// "Send now": this week's statement to every weekly shipper. 409 while a
// run is already going.
export const sendWeeklyStatements = () =>
  apiClient
    .post("/statement/send-weekly")
    .then((res) => parseBody(envelope(statementRunSchema), res.data).data);

// Makes and emails one shipper's statement for the 7 days to today. A failed
// email still returns the saved statement, with emailStatus FAILED.
export const emailStatement = (partyId: string) =>
  apiClient
    .post("/statement/email", { partyId })
    .then((res) => parseBody(envelope(statementSchema), res.data).data);

// "Send latest dues": the shipper's latest billing-period report, as of
// today, with its PDF and CSV.
export const sendLatestDues = (partyId: string) =>
  apiClient
    .post("/statement/dues", { partyId })
    .then((res) => parseBody(envelope(statementSchema), res.data).data);

// The current statement (partyId) or a saved one (statementId) as a PDF
// (reports.export_pdf) or Excel (reports.export_csv).
export const downloadStatement = (
  target: { partyId: string } | { statementId: string },
  format: StatementFormat,
  fallbackName: string
) =>
  getFile(
    "partyId" in target
      ? `/statement/current/${format}`
      : `/statement/${format}`,
    target,
    fallbackName
  );
