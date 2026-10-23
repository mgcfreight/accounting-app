import {
  Currency,
  InvoiceDirection,
  InvoiceStatus,
  MatchStatus,
  PartyType,
  PaymentDirection,
  PaymentMethod,
  ReviewKind,
  SessionEndReason,
  SessionStatus,
  SyncRunStatus,
  Permission,
  TwoFactorMethod,
} from "../enums";
import { PaginationMeta } from "../types";

// Shapes of the data the screens show. Users, sessions, audit and settings
// come from the Accounts API and are checked on arrival (services/schemas.ts);
// the rest are provisional and filled from lib/mock. Money is always a
// 2-decimal string beside its currency, never a number; see lib/money.ts.

// The role shown next to a user. Compare `id` (SystemRoleId), never `name`.
export interface RoleRef {
  id: string;
  name: string;
  isSystem: boolean;
}

// A staff account as the API sends it (UserView). Timestamps are ISO strings.
export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: RoleRef;
  isEnabled: boolean;
  twoFactorEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// GET /auth/me: the signed-in user, what their role allows, and their own
// two-factor state. `isAdmin` is true only for the built-in Admin role, which
// also holds every permission. Presentation only: the API checks every request.
export interface Me extends User {
  isAdmin: boolean;
  permissions: Permission[];
  recoveryCodesRemaining: number;
  twoFactor: {
    authenticatorSetUp: boolean;
    canTurnOff: boolean;
    availableMethods: TwoFactorMethod[];
  };
}

export interface UserRef {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

// A role as the Roles screen sees it (RoleView, Admin only).
export interface Role {
  id: string;
  name: string;
  description: string | null;
  // Admin, Accountant or Viewer: can't be renamed or deleted.
  isSystem: boolean;
  // The Admin role: every permission, plus users, roles and settings.
  isAdmin: boolean;
  // False only for the Admin role.
  permissionsEditable: boolean;
  // In catalog order. Every permission for the Admin role.
  permissions: Permission[];
  userCount: number;
  createdAt: string;
  updatedAt: string;
}

// GET /role/permissions: modules are the matrix's rows, actions its columns.
// A module lists only the actions it has.
export interface PermissionCatalog {
  modules: {
    module: string;
    label: string;
    description: string;
    actions: { action: string; label: string; permission: Permission }[];
  }[];
  actions: { action: string; label: string }[];
}

// One sign-in (user_sessions). Only one is active per user: a new sign-in
// ends the last one as REPLACED.
export interface UserSession {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  browser: string | null;
  os: string | null;
  deviceType: string | null;
  deviceName: string | null;
  startedAt: string;
  lastSeenAt: string;
  expiresAt: string;
  endedAt: string | null;
  endReason: SessionEndReason | null;
  status: SessionStatus;
  durationSeconds: number;
  isCurrent: boolean;
  // Null only if the user row can't be found.
  user: UserRef | null;
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

// GET /audit/events. An Admin sees every event; other roles their own.
export interface AuditEvent {
  id: string;
  action: string;
  actor: UserRef | null;
  sessionId: string | null;
  targetType: string | null;
  targetId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

// A tax rate row (tax_rates). `ratePercent` is text, e.g. "13.000"; never
// parse it into a number. A rate change ends the old row and adds a new one.
export interface TaxRate {
  id: string;
  code: string;
  jurisdiction: string;
  name: string;
  ratePercent: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  isRecoverable: boolean;
  createdAt: string;
}

export interface ChargeType {
  code: string;
  name: string;
  mgcCode: string | null;
  defaultTaxable: boolean;
  isActive: boolean;
}

// Who last saved a settings record.
export interface SettingsEditor {
  id: string;
  firstName: string;
  lastName: string;
}

// Printed on PDFs and emails. Fields are null until an Admin saves them; the
// API never invents a default.
export interface CompanySettings {
  legalName: string | null;
  gstHstNumber: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  country: string | null;
  accountsNotificationEmail: string | null;
  updatedAt: string | null;
  updatedBy: SettingsEditor | null;
}

// Payment terms that get a billing-period notice (COD and PREPAID get none).
export type NoticeTerms = "NET_7" | "NET_15" | "NET_30" | "NET_60";

// How many days before a period ends its notice goes out, by terms (v5
// defaults 2/4/7/7), and the default carrier "payment due soon" alert —
// null until an Admin sets it (open question in v5). Stored only: nothing
// sends notices yet.
export interface NoticeSettings {
  defaultNoticeDays: Record<NoticeTerms, number>;
  carrierAlertDaysBefore: number | null;
  updatedAt: string | null;
  updatedBy: SettingsEditor | null;
}

// A closed month can't be changed (accounting_periods). Months with no row
// are open.
export interface AccountingPeriod {
  id: string;
  // "YYYY-MM"
  period: string;
  status: "OPEN" | "CLOSED";
  closedAt: string | null;
  closedBy: SettingsEditor | null;
  updatedAt: string;
}

export interface Paginated<T> {
  items: T[];
  meta: PaginationMeta;
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
