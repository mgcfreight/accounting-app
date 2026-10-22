import {
  Currency,
  InvoiceDirection,
  InvoiceStatus,
  MatchStatus,
  PartyType,
  PaymentDirection,
  PaymentMethod,
  ReviewKind,
  SyncRunStatus,
  UserRole,
} from "../enums";

// Shapes of the data the screens show. Most are provisional and filled from
// lib/mock; User is the API's UserView. Money is always a 2-decimal string
// beside its currency, never a number; see lib/money.ts.

// The API's UserView (GET /auth/me, /user/all). Timestamps are ISO strings.
export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  isEnabled: boolean;
  twoFactorEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Address {
  city: string;
  province: string;
  country: string;
  postalCode: string;
}

export interface Party {
  id: string;
  type: PartyType;
  name: string;
  billingEmails: string[];
  ccEmails: string[];
  currency: Currency;
  termsDays: number;
  gstHstNumber?: string;
  address: Address;
  balance: string;
  overdue: string;
  lastPaymentOn?: string;
  shipmentCount: number;
}

export interface InvoiceLine {
  id: string;
  kind: string;
  description: string;
  amount: string;
  taxCode: string;
  taxAmount: string;
}

export interface Adjustment {
  id: string;
  number: string;
  type: "CREDIT" | "DEBIT";
  reason: string;
  total: string;
  createdOn: string;
}

export interface InvoicePaymentRow {
  id: string;
  paymentNumber: string;
  method: PaymentMethod;
  paidOn: string;
  amount: string;
}

export interface Attachment {
  id: string;
  kind: "BOL" | "POD" | "MGC_INVOICE" | "OTHER";
  fileName: string;
}

export interface HistoryEntry {
  id: string;
  at: string;
  user: string;
  action: string;
}

export interface Invoice {
  id: string;
  number: string;
  direction: InvoiceDirection;
  partyId: string;
  partyName: string;
  shipmentId: string;
  origin: string;
  destination: string;
  status: InvoiceStatus;
  currency: Currency;
  invoiceDate: string;
  dueDate: string;
  subtotal: string;
  taxTotal: string;
  total: string;
  balance: string;
  overdueDays: number;
  disputed: boolean;
  carrierBillNo?: string;
  lines: InvoiceLine[];
  adjustments: Adjustment[];
  payments: InvoicePaymentRow[];
  attachments: Attachment[];
  history: HistoryEntry[];
}

export interface Payment {
  id: string;
  number: string;
  direction: PaymentDirection;
  partyName: string;
  method: PaymentMethod;
  source: "MANUAL" | "MGC_STRIPE";
  reference: string;
  paidOn: string;
  currency: Currency;
  amount: string;
  unapplied: string;
  match: MatchStatus;
}

export interface ReviewItem {
  id: string;
  kind: ReviewKind;
  shipmentId: string;
  invoiceNumber: string;
  partyName: string;
  currency: Currency;
  previousAmount: string;
  newAmount: string;
  detectedAt: string;
}

export interface SyncResource {
  resource: string;
  checkpoint: string;
  recordsLastRun: number;
}

export interface SyncRun {
  id: string;
  startedAt: string;
  finishedAt?: string;
  status: SyncRunStatus;
  records: number;
  error?: string;
}

export interface AuditEntry {
  id: string;
  at: string;
  user: string;
  entity: string;
  entityId: string;
  action: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

export interface TaxRate {
  id: string;
  code: string;
  province: string;
  taxType: string;
  ratePercent: string;
  effectiveFrom: string;
}

// One row of the aging report: open balances by days past due (design §8.6).
export interface AgingRow {
  label: string;
  current: string;
  days1to30: string;
  days31to60: string;
  days61to90: string;
  days90plus: string;
  disputed: string;
  total: string;
  currency: Currency;
}

export interface Statement {
  id: string;
  periodFrom: string;
  periodTo: string;
  sentAt: string;
  closingBalance: string;
}

export interface MonthlyPnl {
  month: string;
  revenue: string;
  carrierCost: string;
  grossMargin: string;
  marginPercent: string;
}
