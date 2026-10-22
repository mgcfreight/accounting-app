import { Currency, ReviewKind, SyncRunStatus } from "../enums";
import {
  AuditEntry,
  ReviewItem,
  SyncResource,
  SyncRun,
  TaxRate,
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

export const mockAuditLog: AuditEntry[] = [
  {
    id: "A-9921",
    at: "2026-10-19T13:21:00Z",
    user: "Sam Patel",
    entity: "Payment",
    entityId: "P-2047",
    action: "Created",
    after: { amount: "1500.00", currency: "CAD", method: "E_TRANSFER", match: "UNMATCHED" },
  },
  {
    id: "A-9920",
    at: "2026-10-18T18:10:00Z",
    user: "Sync",
    entity: "Shipment",
    entityId: "SHP-8F2P4",
    action: "Sent to Needs review",
    before: { status: "BOOKED" },
    after: { status: "CANCELLED" },
  },
  {
    id: "A-9919",
    at: "2026-10-18T13:42:00Z",
    user: "Sync",
    entity: "Shipment",
    entityId: "SHP-8F2K1",
    action: "Sent to Needs review",
    before: { shipperAmount: "2450.00" },
    after: { shipperAmount: "2610.00" },
  },
  {
    id: "A-9918",
    at: "2026-10-17T20:10:00Z",
    user: "Sync",
    entity: "Invoice",
    entityId: "INV-10425",
    action: "Created",
    after: { status: "DRAFT", total: "1127.00", currency: "CAD" },
  },
  {
    id: "A-9917",
    at: "2026-10-15T14:30:00Z",
    user: "Sam Patel",
    entity: "Payment",
    entityId: "P-2045",
    action: "Allocated",
    before: { balance: "2709.00" },
    after: { invoice: "CINV-10423", balance: "0.00", status: "PAID" },
  },
  {
    id: "A-9916",
    at: "2026-10-11T09:00:00Z",
    user: "Sync",
    entity: "Invoice",
    entityId: "INV-10427",
    action: "Voided",
    before: { status: "DRAFT" },
    after: { status: "VOID" },
  },
  {
    id: "A-9915",
    at: "2026-10-10T15:20:00Z",
    user: "Sam Patel",
    entity: "Payment",
    entityId: "P-2042",
    action: "Allocated",
    before: { balance: "2221.13", status: "ISSUED" },
    after: { invoice: "INV-10422", balance: "1221.13", status: "PARTIALLY_PAID" },
  },
  {
    id: "A-9914",
    at: "2026-10-02T14:00:00Z",
    user: "Jordan Lee",
    entity: "Tax rate",
    entityId: "HST-NS",
    action: "Updated",
    before: { rate: "15.000" },
    after: { rate: "14.000", effectiveFrom: "2025-04-01" },
  },
  {
    id: "A-9913",
    at: "2026-09-30T14:05:00Z",
    user: "Sam Patel",
    entity: "Invoice",
    entityId: "INV-10424",
    action: "Disputed",
    before: { disputed: false },
    after: { disputed: true, reason: "Customer says liftgate was not used" },
  },
];

export const mockTaxRates: TaxRate[] = [
  { id: "T1", code: "HST-ON", province: "Ontario", taxType: "HST", ratePercent: "13.000", effectiveFrom: "2010-07-01" },
  { id: "T2", code: "HST-NS", province: "Nova Scotia", taxType: "HST", ratePercent: "14.000", effectiveFrom: "2025-04-01" },
  { id: "T3", code: "HST-NB", province: "New Brunswick", taxType: "HST", ratePercent: "15.000", effectiveFrom: "2016-07-01" },
  { id: "T4", code: "HST-NL", province: "Newfoundland and Labrador", taxType: "HST", ratePercent: "15.000", effectiveFrom: "2016-07-01" },
  { id: "T5", code: "HST-PE", province: "Prince Edward Island", taxType: "HST", ratePercent: "15.000", effectiveFrom: "2016-10-01" },
  { id: "T6", code: "GST", province: "AB, BC, MB, SK, NT, NU, YT", taxType: "GST", ratePercent: "5.000", effectiveFrom: "2008-01-01" },
  { id: "T7", code: "QST", province: "Quebec (with GST)", taxType: "QST", ratePercent: "9.975", effectiveFrom: "2013-01-01" },
  { id: "T8", code: "ZERO", province: "Cross-border / international", taxType: "Zero-rated", ratePercent: "0.000", effectiveFrom: "2008-01-01" },
];
