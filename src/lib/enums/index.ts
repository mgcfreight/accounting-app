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
