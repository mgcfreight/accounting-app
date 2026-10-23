import {
  AdjustmentMode,
  AuditAction,
  AuditTargetType,
  BillingTrigger,
  CarrierInvoiceStatus,
  Currency,
  CustomerInvoiceStatus,
  InvoiceDirection,
  InvoiceKind,
  InvoiceReviewFlag,
  InvoiceStatus,
  MatchStatus,
  PartyType,
  PaymentDirection,
  PaymentMethod,
  PaymentStatus,
  PaymentTerms,
  ReviewKind,
  SessionEndReason,
  SessionStatus,
  ShipmentSource,
  SyncRunStatus,
  TaxBasis,
  TaxTreatment,
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

// ---------------------------------------------------------------------------
// The Accounts API's views, field for field (its src/dto/*/*.view.ts). The
// mock shapes above stay for the screens still on mock data.
//
// Money is a 2-decimal string ("1356.00"). Quantities, unit prices, FX and
// tax rates are decimal strings with their own precision. Calendar dates are
// "YYYY-MM-DD"; timestamps are ISO strings.

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
  // Newest first. Only from the single-party endpoint.
  agreements?: AgreementView[];
}

export interface ShipmentView {
  id: string;
  mgcShipmentId: string;
  loadNumber: string;
  bolNumber: string | null;
  pickupNumber: string | null;
  poNumber: string | null;
  soNumber: string | null;
  proNumber: string | null;
  quoteNumber: string | null;
  billNumber: string | null;
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

export interface ChargeTypeView {
  code: string;
  name: string;
  defaultTaxable: boolean;
}

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
  // Sent back with every change; a stale one gets a 409.
  version: number;
  createdAt: string;
  updatedAt: string;
  // Only from the single-invoice endpoints.
  lines?: InvoiceLineView[];
}

export interface CustomerInvoiceView extends InvoiceViewBase {
  invoiceNumber: string | null;
  customerId: string;
  customerName: string;
  status: CustomerInvoiceStatus;
  billTo: InvoiceBillTo;
  issuedAt: string | null;
  sentAt: string | null;
}

export interface CarrierInvoiceView extends InvoiceViewBase {
  referenceNumber: string | null;
  carrierInvoiceNumber: string | null;
  carrierId: string;
  carrierName: string;
  status: CarrierInvoiceStatus;
  billingTrigger: BillingTrigger;
  expectedTotal: string;
  varianceAmount: string | null;
  receivedAt: string | null;
  approvedAt: string | null;
  approvedById: string | null;
  holdReason: string | null;
}

// Facts about an audit event, at most two levels deep.
export type AuditScalar = string | number | boolean | null;
export type AuditDetails = Record<
  string,
  AuditScalar | Record<string, AuditScalar>
>;

export interface AuditEventView {
  id: string;
  action: AuditAction;
  actor: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  sessionId: string | null;
  targetType: AuditTargetType | null;
  targetId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  details: AuditDetails | null;
  createdAt: string;
}

// One sign-in, from /auth/sessions and /user/sessions.
export interface SessionView {
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
}
