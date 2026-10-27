// String values, as the Accounts API will send them — unlike mokal-backend,
// where currency is stored as USD = 1, CAD = 2.

// The built-in roles' fixed ids. Check a role by id, never by name: custom
// roles' names are free text.
export enum SystemRoleId {
  Admin = "rol_ADMIN00000",
  Accountant = "rol_ACCOUNTANT",
  Viewer = "rol_VIEWER0000",
}

// `<module>.<action>`, as the API's Permission enum. Mirrored here for gating
// screens and buttons; the Roles screen reads the catalog from the API.
// Users, roles and settings changes are Admin only and not permissions.
export enum Permission {
  PartiesView = "parties.view",
  PartiesCreate = "parties.create",
  // Agreed terms.
  PartiesEdit = "parties.edit",

  ShipmentsView = "shipments.view",
  ShipmentsCreate = "shipments.create",

  CustomerInvoicesView = "customer_invoices.view",
  // Adjustments and credit notes.
  CustomerInvoicesCreate = "customer_invoices.create",
  CustomerInvoicesEdit = "customer_invoices.edit",
  CustomerInvoicesIssue = "customer_invoices.issue",
  CustomerInvoicesVoid = "customer_invoices.void",
  CustomerInvoicesExportPdf = "customer_invoices.export_pdf",
  CustomerInvoicesSendEmail = "customer_invoices.send_email",

  CarrierInvoicesView = "carrier_invoices.view",
  // Adjustments and credit notes.
  CarrierInvoicesCreate = "carrier_invoices.create",
  // Details and recording the carrier's bill.
  CarrierInvoicesEdit = "carrier_invoices.edit",
  CarrierInvoicesApprove = "carrier_invoices.approve",
  CarrierInvoicesVoid = "carrier_invoices.void",
  CarrierInvoicesExportPdf = "carrier_invoices.export_pdf",

  CustomerPaymentsView = "customer_payments.view",
  CustomerPaymentsCreate = "customer_payments.create",
  // Reverse a posted payment.
  CustomerPaymentsVoid = "customer_payments.void",
  CustomerPaymentsExportCsv = "customer_payments.export_csv",

  CarrierPaymentsView = "carrier_payments.view",
  CarrierPaymentsCreate = "carrier_payments.create",
  CarrierPaymentsVoid = "carrier_payments.void",
  CarrierPaymentsExportCsv = "carrier_payments.export_csv",

  // Billing-period reports, dues reports and statements.
  ReportsView = "reports.view",
  ReportsExportPdf = "reports.export_pdf",
  ReportsExportCsv = "reports.export_csv",
  // "Send latest dues" and statement emails.
  ReportsSendEmail = "reports.send_email",
}

// What POST /auth/login asks for next.
export enum SignInStep {
  TwoFactor = "TWO_FACTOR",
  TwoFactorSetup = "TWO_FACTOR_SETUP",
  SignedIn = "SIGNED_IN",
}

export enum TwoFactorMethod {
  Totp = "TOTP",
  RecoveryCode = "RECOVERY_CODE",
  Email = "EMAIL",
}

export enum SessionStatus {
  Active = "ACTIVE",
  Ended = "ENDED",
  Expired = "EXPIRED",
}

export enum SessionEndReason {
  Logout = "LOGOUT",
  Replaced = "REPLACED",
  PasswordReset = "PASSWORD_RESET",
  Revoked = "REVOKED",
  TokenReuse = "TOKEN_REUSE",
  Locked = "LOCKED",
}

export enum Currency {
  CAD = "CAD",
  USD = "USD",
}

export enum InvoiceDirection {
  Receivable = "AR",
  Payable = "AP",
}

export enum InvoiceStatus {
  Draft = "DRAFT",
  Issued = "ISSUED",
  PartiallyPaid = "PARTIALLY_PAID",
  Paid = "PAID",
  // Replaced by a newer version (INV-10422 -> INV-10422a); kept as sent.
  Superseded = "SUPERSEDED",
  Void = "VOID",
  WrittenOff = "WRITTEN_OFF",
}

export enum PartyType {
  Shipper = "SHIPPER",
  Carrier = "CARRIER",
}

export enum PaymentDirection {
  In = "IN",
  Out = "OUT",
}

export enum PaymentMethod {
  Card = "CARD",
  ETransfer = "E_TRANSFER",
  Eft = "EFT",
  Cheque = "CHEQUE",
  Wire = "WIRE",
  Cash = "CASH",
}

export enum MatchStatus {
  Matched = "MATCHED",
  Partial = "PARTIAL",
  Unmatched = "UNMATCHED",
}

export enum ReviewKind {
  Cancellation = "CANCELLATION",
  AmountChange = "AMOUNT_CHANGE",
}

export enum SyncRunStatus {
  Success = "SUCCESS",
  Failed = "FAILED",
  Running = "RUNNING",
}

// ---------------------------------------------------------------------------
// The Accounts API's invoicing enums, value for value (its src/types).

export enum PaymentTerms {
  COD = "COD",
  Prepaid = "PREPAID",
  Net7 = "NET_7",
  Net15 = "NET_15",
  Net30 = "NET_30",
  Net60 = "NET_60",
}

export enum TaxTreatment {
  Standard = "STANDARD",
  ZeroRated = "ZERO_RATED",
  Exempt = "EXEMPT",
}

// Which address picks the tax rate.
export enum TaxBasis {
  BillTo = "BILL_TO",
  Destination = "DESTINATION",
}

// When a carrier's bill arrives, and so when MGC pays. Carriers only.
export enum BillingTrigger {
  Prepaid = "PREPAID",
  COD = "COD",
  OnShipmentCreated = "ON_SHIPMENT_CREATED",
  OnDeliveryWithPod = "ON_DELIVERY_WITH_POD",
}

export enum AdjustmentMode {
  Separate = "SEPARATE",
  Merged = "MERGED",
}

export enum ShipmentSource {
  Api = "API",
  Manual = "MANUAL",
}

export enum InvoiceKind {
  Standard = "STANDARD",
  Adjustment = "ADJUSTMENT",
  CreditNote = "CREDIT_NOTE",
}

// SUPERSEDED: replaced by a new version (230 -> 230a); kept as it was sent,
// but no longer counts towards any balance.
export enum CustomerInvoiceStatus {
  Draft = "DRAFT",
  Issued = "ISSUED",
  Superseded = "SUPERSEDED",
  Void = "VOID",
}

// EXPECTED: made with the shipment, the carrier's bill not in yet (owes 0).
// ON_HOLD: the bill came in different from what was expected.
export enum CarrierInvoiceStatus {
  Expected = "EXPECTED",
  Received = "RECEIVED",
  OnHold = "ON_HOLD",
  Approved = "APPROVED",
  Superseded = "SUPERSEDED",
  Void = "VOID",
}

// A part-payment stays UNPAID; amountPaid shows how much came in.
export enum PaymentStatus {
  Unpaid = "UNPAID",
  Paid = "PAID",
}

export enum InvoiceReviewFlag {
  TermsMismatch = "TERMS_MISMATCH",
  NoReferenceNumber = "NO_REFERENCE_NUMBER",
  NoTmsCode = "NO_TMS_CODE",
  NoFxRate = "NO_FX_RATE",
  // Set by the Accounts API's TMS sync.
  TmsChanged = "TMS_CHANGED",
  TmsCancelled = "TMS_CANCELLED",
  UnknownCharge = "UNKNOWN_CHARGE",
}

// Invoice list sort columns (the API's InvoiceSortBy).
export enum InvoiceSortBy {
  InvoiceDate = "invoiceDate",
  DueDate = "dueDate",
  Total = "total",
  BalanceDue = "balanceDue",
  Sequence = "sequence",
}

export enum SortOrder {
  Asc = "ASC",
  Desc = "DESC",
}

// Statements, reminders, allocation, installments and disputes: no API yet;
// the screens read lib/mock.

export enum StatementRunKind {
  DailyRefresh = "DAILY_REFRESH",
  WeeklyEmail = "WEEKLY_EMAIL",
}

export enum ReminderChannel {
  // Emailed to the shipper's accounts department.
  CustomerEmail = "CUSTOMER_EMAIL",
  // An alert to MGC's accounts team that a carrier bill falls due.
  TeamAlert = "TEAM_ALERT",
}

export enum ReminderStatus {
  Scheduled = "SCHEDULED",
  Sent = "SENT",
  Skipped = "SKIPPED",
}

export enum AllocationRule {
  InvoiceNumber = "INVOICE_NUMBER",
  ExactAmount = "EXACT_AMOUNT",
  OldestOpen = "OLDEST_OPEN",
  Manual = "MANUAL",
}

export enum InstallmentStatus {
  Paid = "PAID",
  Due = "DUE",
  Late = "LATE",
}

export enum DisputeStatus {
  Open = "OPEN",
  Resolved = "RESOLVED",
}
