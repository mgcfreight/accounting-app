import { Currency, ReviewKind, SyncRunStatus } from "../enums";
import {
  ReviewItem,
  SyncResource,
  SyncRun,
} from "../interfaces";

export const mockReviewItems: ReviewItem[] = [
  {
    id: "R-31",
    kind: ReviewKind.AmountChange,
    shipmentId: "SHP-8F2K1",
    invoiceNumber: "INV-10421",
    partyName: "Northwind Distribution",
    currency: Currency.CAD,
    previousAmount: "2450.00",
    newAmount: "2610.00",
    detectedAt: "2026-10-18T13:42:00Z",
  },
  {
    id: "R-30",
    kind: ReviewKind.Cancellation,
    shipmentId: "SHP-8F2P4",
    invoiceNumber: "INV-10431",
    partyName: "Pacific Rim Traders",
    currency: Currency.CAD,
    previousAmount: "1450.00",
    newAmount: "0.00",
    detectedAt: "2026-10-18T18:10:00Z",
  },
];

export const mockSyncSummary = {
  lastRunAt: "2026-10-19T13:50:00Z",
  nextRunAt: "2026-10-19T14:00:00Z",
  lastStatus: SyncRunStatus.Success,
  consecutiveFailures: 0,
  nightlyCheckAt: "2026-10-19T05:00:00Z",
  nightlyCheckResult: "Counts and totals match for the last 90 days",
};

export const mockSyncResources: SyncResource[] = [
  { resource: "Shippers", checkpoint: "2026-10-19T13:41:07Z", recordsLastRun: 1 },
  { resource: "Carriers", checkpoint: "2026-10-12T09:15:22Z", recordsLastRun: 0 },
  { resource: "Shipments", checkpoint: "2026-10-19T13:48:51Z", recordsLastRun: 3 },
  { resource: "Invoices", checkpoint: "2026-10-19T13:48:52Z", recordsLastRun: 3 },
  { resource: "Payments", checkpoint: "2026-10-19T12:02:10Z", recordsLastRun: 0 },
];

export const mockSyncRuns: SyncRun[] = [
  { id: "RUN-5812", startedAt: "2026-10-19T13:50:00Z", finishedAt: "2026-10-19T13:50:04Z", status: SyncRunStatus.Success, records: 7 },
  { id: "RUN-5811", startedAt: "2026-10-19T13:40:00Z", finishedAt: "2026-10-19T13:40:03Z", status: SyncRunStatus.Success, records: 2 },
  { id: "RUN-5810", startedAt: "2026-10-19T13:30:00Z", finishedAt: "2026-10-19T13:31:00Z", status: SyncRunStatus.Failed, records: 0, error: "MGC API timed out after 60s; retried on the next run" },
  { id: "RUN-5809", startedAt: "2026-10-19T13:20:00Z", finishedAt: "2026-10-19T13:20:02Z", status: SyncRunStatus.Success, records: 0 },
  { id: "RUN-5808", startedAt: "2026-10-19T13:10:00Z", finishedAt: "2026-10-19T13:10:05Z", status: SyncRunStatus.Success, records: 4 },
  { id: "RUN-5807", startedAt: "2026-10-19T13:00:00Z", finishedAt: "2026-10-19T13:00:02Z", status: SyncRunStatus.Success, records: 1 },
];
