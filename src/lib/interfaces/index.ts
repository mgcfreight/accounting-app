import {
  AdjustmentMode,
  AllocationRule,
  BillingTrigger,
  CarrierInvoiceStatus,
  Currency,
  CustomerInvoiceStatus,
  DisputeStatus,
  FxRateSource,
  InstallmentStatus,
  InvoiceDirection,
  InvoiceKind,
  InvoiceReviewFlag,
  InvoiceStatus,
  MatchStatus,
  PartyType,
  PaymentDirection,
  PaymentMethod,
  PaymentRecordStatus,
  PaymentStatus,
  PaymentTerms,
  ReminderChannel,
  ReminderStatus,
  ReviewKind,
  SessionEndReason,
  SessionStatus,
  ShipmentSource,
  StatementRunKind,
  SyncRunStatus,
  Permission,
  TaxBasis,
  TaxTreatment,
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
  // Versions: a change of service replaces the invoice with a new one
  // (INV-10422 -> INV-10422a). Absent on an invoice never changed.
  revision?: number;
  revisionReason?: string;
  replacesId?: string;
  replacedById?: string;
  replacedAt?: string;
  // Issued but not emailed yet (sending isn't built).
  notSent?: boolean;
  lines: InvoiceLine[];
  adjustments: Adjustment[];
  payments: InvoicePaymentRow[];
  attachments: Attachment[];
  history: HistoryEntry[];
}

// A payment as the Accounts API returns it (GET /payment/all,
// /payment/customer|carrier). Amounts are 2-decimal strings in `currency`.
export interface Payment {
  id: string;
  // SPAY-<n> (money in) or CPAY-<n> (money out).
  number: string;
  direction: PaymentDirection;
  partyId: string;
  partyName: string | null;
  // The day the money moved.
  paidOn: string;
  amount: string;
  currency: Currency;
  // USD: null until the Bank of Canada publishes that day's rate.
  fxRateToCad: string | null;
  fxRateSource: FxRateSource | null;
  method: PaymentMethod;
  reference: string | null;
  // Not yet allocated: credit on the party's account.
  unapplied: string;
  source: "MANUAL" | "MGC_STRIPE";
  match: MatchStatus;
  status: PaymentRecordStatus;
  reversedAt: string | null;
  reversalReason: string | null;
  notes: string | null;
  version: number;
  createdAt: string;
  // What matching proposes for the unapplied money, for staff to confirm.
  suggested: SuggestedAllocation[];
  // Where the money went: newest first, reversed ones included.
  allocations: Allocation[];
}

// Part of a payment applied to one invoice, and how it was matched.
export interface Allocation {
  id: string;
  invoiceId: string;
  // Null until the invoice has its TMS code.
  invoiceNumber: string | null;
  creditNoteId: string | null;
  amount: string;
  allocatedOn: string;
  // Null on rows from before these were kept.
  invoiceBalanceBefore: string | null;
  invoiceBalanceAfter: string | null;
  rule: AllocationRule;
  reversedAt: string | null;
  reversedById: string | null;
  createdAt: string;
}

// One line of the matching suggestion. Nothing is saved until staff confirm.
export interface SuggestedAllocation {
  invoiceId: string;
  invoiceNumber: string | null;
  dueDate: string | null;
  invoiceBalanceBefore: string;
  amount: string;
  invoiceBalanceAfter: string;
  rule: AllocationRule;
}

// GET .../suggestion: how matching would spread what is unapplied.
export interface AllocationSuggestion {
  paymentId: string;
  currency: Currency;
  unapplied: string;
  allocations: SuggestedAllocation[];
  // What would stay on the payment as unapplied credit.
  leftOver: string;
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

// ---------------------------------------------------------------------------
// Parties, shipments and invoices as the Accounts API sends them (its
// *View types). Money is a 2-decimal string; quantities, unit prices and
// rates are decimal strings with their own precision. Never parse either.

// Agreed terms from a date. A carrier's has a billing trigger; a
// customer's doesn't.
export interface AgreementView {
  id: string;
  partyId: string;
  paymentTerms: PaymentTerms;
  currency: Currency;
  taxTreatment: TaxTreatment;
  taxBasis: TaxBasis;
  billingTrigger: BillingTrigger | null;
  noticeDaysBefore: number | null;
  alertDaysBefore: number | null;
  defaultAdjustmentMode: AdjustmentMode;
  autoSendInvoices: boolean;
  billingNoticeEnabled: boolean;
  remindersEnabled: boolean;
  weeklyStatementEnabled: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  notes: string | null;
  createdAt: string;
}

export interface PartyView {
  id: string;
  type: PartyType;
  mgcId: string;
  name: string;
  legalName: string | null;
  gstHstNumber: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  country: string;
  defaultCurrency: Currency;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // Contact addresses as the TMS holds them (shippers); null when it has
  // none. Absent until the API's TMS sync ships.
  email?: string | null;
  businessEmail?: string | null;
  // Newest first. Only from the single-party endpoint.
  agreements?: AgreementView[];
}

// The seven numbers that tell a party which load an invoice is for.
export interface ReferenceNumbers {
  bolNumber: string | null;
  pickupNumber: string | null;
  poNumber: string | null;
  soNumber: string | null;
  proNumber: string | null;
  quoteNumber: string | null;
  billNumber: string | null;
}

// Carries party ids only: names are looked up from the parties.
export interface ShipmentView extends ReferenceNumbers {
  id: string;
  mgcShipmentId: string;
  loadNumber: string;
  source: ShipmentSource;
  shipperPartyId: string;
  carrierPartyId: string | null;
  tmsStatus: string;
  tmsPaymentTerms: PaymentTerms;
  invoiceSequence: string | null;
  tmsCustomerInvoiceCode: string | null;
  tmsCarrierInvoiceCode: string | null;
  originCity: string | null;
  originProvince: string | null;
  originCountry: string | null;
  destinationCity: string | null;
  destinationProvince: string | null;
  destinationCountry: string | null;
  pickupDate: string | null;
  deliveryDate: string | null;
  sellCurrency: Currency;
  sellTotal: string;
  buyCurrency: Currency | null;
  buyTotal: string | null;
  mgcCreatedAt: string;
  createdAt: string;
}

// GET /invoice/charge-types: the active ones an invoice line can use.
export type InvoiceChargeType = Pick<
  ChargeType,
  "code" | "name" | "defaultTaxable"
>;

export interface InvoiceLineView {
  id: string;
  lineNo: number;
  chargeTypeCode: string;
  description: string;
  quantity: string;
  unitPrice: string;
  amount: string;
  isTaxable: boolean;
  mgcChargeId: string | null;
}

// One tax on an invoice. Snake case, as the API stores and sends it.
export interface InvoiceTax {
  tax_rate_id: string;
  code: string;
  jurisdiction: string;
  rate_percent: string;
  taxable_amount: string;
  tax_amount: string;
}

// The customer's billing address as it was when the invoice was made.
export interface InvoiceBillTo {
  name: string;
  legal_name: string | null;
  gst_hst_number: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  country: string;
}

export interface InvoiceViewBase extends ReferenceNumbers {
  id: string;
  tmsInvoiceCode: string | null;
  sequenceValue: string | null;
  suffix: string;
  kind: InvoiceKind;
  shipmentId: string | null;
  agreementId: string;
  paymentStatus: PaymentStatus;
  currency: Currency;
  fxRateToCad: string | null;
  paymentTerms: PaymentTerms;
  invoiceDate: string | null;
  dueDate: string | null;
  taxBasis: TaxBasis;
  taxJurisdiction: string;
  subtotal: string;
  taxes: InvoiceTax[];
  taxTotal: string;
  total: string;
  amountPaid: string;
  balanceDue: string;
  notes: string | null;
  reviewFlags: InvoiceReviewFlag[];
  // The version this one replaced (230 for 230a); null on the first.
  parentInvoiceId: string | null;
  // 0 on the first version, then 1, 2… Not `version`, the edit counter.
  revision: number;
  revisionReason: string | null;
  supersededAt: string | null;
  // Sent back with every change; a stale one gets a 409.
  version: number;
  createdAt: string;
  updatedAt: string;
  // Only from the single-invoice endpoints.
  lines?: InvoiceLineView[];
  // An open dispute on it. Absent from an API without disputes.
  disputed?: boolean;
}

// `billTo.name` is the customer's name as invoiced.
export interface CustomerInvoiceView extends InvoiceViewBase {
  invoiceNumber: string | null;
  customerId: string;
  status: CustomerInvoiceStatus;
  billTo: InvoiceBillTo;
  issuedAt: string | null;
  sentAt: string | null;
}

// Carries the carrier's id only: its name is looked up from the parties.
export interface CarrierInvoiceView extends InvoiceViewBase {
  referenceNumber: string | null;
  carrierInvoiceNumber: string | null;
  carrierId: string;
  status: CarrierInvoiceStatus;
  billingTrigger: BillingTrigger;
  expectedTotal: string;
  varianceAmount: string | null;
  receivedAt: string | null;
  approvedAt: string | null;
  approvedById: string | null;
  holdReason: string | null;
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

// ---------------------------------------------------------------------------
// Provisional shapes for the screens with no API yet (statements, reminders,
// allocation, installment plans, disputes, report breakdowns), filled from
// lib/mock. Every amount is already calculated, as the API will send it.

// A shipper's or carrier's account at a glance (statements, requirement 2).
export interface PartyAccountSummary {
  partyId: string;
  partyName: string;
  type: PartyType;
  currency: Currency;
  // Invoiced this calendar year, and the number of shipments behind it.
  businessVolume: string;
  shipmentCount: number;
  balance: string;
  overdue: string;
  // Days past due of the oldest overdue invoice; 0 when nothing is overdue.
  oldestOverdueDays: number;
  // Null when nothing has been paid yet. `invoiceRef` is null for a payment
  // that isn't allocated to an invoice yet.
  lastPayment: {
    paidOn: string;
    paymentNumber: string;
    invoiceRef: string | null;
    amount: string;
  } | null;
  // Average days from invoice date to full payment, over the last 12 months.
  averagePaymentDays: number | null;
  // Shippers only: emailed a statement every Friday.
  weeklyStatement: boolean;
  statementEmail: string | null;
}

// One run of the statement jobs: the daily refresh of every balance, and the
// Friday email of shipper statements.
export interface StatementRun {
  id: string;
  kind: StatementRunKind;
  ranAt: string;
  partyCount: number;
  // Weekly email only.
  sentCount: number | null;
  failedCount: number | null;
}

// A payment reminder, 7 days before an invoice's due date.
export interface Reminder {
  id: string;
  direction: InvoiceDirection;
  invoiceNumber: string;
  partyName: string;
  dueDate: string;
  remindOn: string;
  currency: Currency;
  balance: string;
  channel: ReminderChannel;
  recipient: string;
  status: ReminderStatus;
  sentAt: string | null;
  // Why a reminder was skipped (paid in full, reminders off, disputed).
  note: string | null;
}


export interface Installment {
  number: number;
  dueDate: string;
  amount: string;
  status: InstallmentStatus;
  paidOn: string | null;
}

// An agreed plan to pay one or more invoices in parts.
export interface InstallmentPlan {
  id: string;
  direction: PaymentDirection;
  partyName: string;
  invoiceNumbers: string[];
  currency: Currency;
  total: string;
  paid: string;
  remaining: string;
  agreedOn: string;
  installments: Installment[];
}

// An invoice the shipper or carrier disputes. While open, its balance sits in
// the aging report's Disputed column and reminders are paused.
export interface Dispute {
  id: string;
  direction: InvoiceDirection;
  invoiceNumber: string;
  partyName: string;
  currency: Currency;
  disputedAmount: string;
  reason: string;
  openedOn: string;
  openedBy: string;
  status: DisputeStatus;
  resolution: string | null;
  resolvedOn: string | null;
}

// A month or quarter of the books, CAD at invoice-date rates.
export interface PeriodSummary {
  key: string;
  period: string;
  revenue: string;
  carrierCost: string;
  grossMargin: string;
  marginPercent: string;
  taxCollected: string;
  inputTaxCredits: string;
  collected: string;
  paidOut: string;
}

// Profit and loss for one shipper or carrier over a period, CAD.
export interface PartyPnl {
  partyId: string;
  partyName: string;
  type: PartyType;
  shipmentCount: number;
  revenue: string;
  carrierCost: string;
  grossMargin: string;
  marginPercent: string;
}

// One line of the HST/GST summary: tax charged on shipper invoices against
// input tax credits on carrier bills, per tax and province.
export interface TaxSummaryRow {
  key: string;
  jurisdiction: string;
  taxCode: string;
  ratePercent: string;
  taxableSales: string;
  taxCollected: string;
  taxablePurchases: string;
  inputTaxCredits: string;
  netTax: string;
}
