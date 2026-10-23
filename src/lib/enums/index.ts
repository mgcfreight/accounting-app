// String values, as the Accounts API will send them — unlike mokal-backend,
// where currency is stored as USD = 1, CAD = 2.

// The API's Role enum, value for value.
export enum UserRole {
  Admin = "Admin",
  Accountant = "Accountant",
  Viewer = "Viewer",
}

// What POST /auth/login asks for next.
export enum SignInStep {
  // 2FA is on: enter a code by one of the challenge's methods.
  TwoFactor = "TWO_FACTOR",
  // An Admin without 2FA: set it up before signing in.
  TwoFactorSetup = "TWO_FACTOR_SETUP",
  SignedIn = "SIGNED_IN",
}

export enum TwoFactorMethod {
  Totp = "TOTP",
  RecoveryCode = "RECOVERY_CODE",
  Email = "EMAIL",
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

export enum CustomerInvoiceStatus {
  Draft = "DRAFT",
  Issued = "ISSUED",
  Void = "VOID",
}

// EXPECTED: made with the shipment, the carrier's bill not in yet (owes 0).
// ON_HOLD: the bill came in different from what was expected.
export enum CarrierInvoiceStatus {
  Expected = "EXPECTED",
  Received = "RECEIVED",
  OnHold = "ON_HOLD",
  Approved = "APPROVED",
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

export enum AuditAction {
  SignedIn = "auth.signed_in",
  SignInFailed = "auth.sign_in_failed",
  TwoFactorCodeRejected = "auth.2fa_code_rejected",
  AccountLocked = "auth.account_locked",
  SignedOut = "auth.signed_out",
  RefreshTokenReused = "auth.refresh_token_reused",
  PasswordChanged = "auth.password_changed",
  PasswordResetRequested = "auth.password_reset_requested",
  PasswordReset = "auth.password_reset",
  TwoFactorEnabled = "auth.2fa_enabled",
  TwoFactorDisabled = "auth.2fa_disabled",
  TwoFactorEmailCodeSent = "auth.2fa_email_code_sent",
  RecoveryCodesRegenerated = "auth.recovery_codes_regenerated",
  UserCreated = "user.created",
  UserUpdated = "user.updated",
  UserEnabled = "user.enabled",
  UserDisabled = "user.disabled",
  UserPasswordSet = "user.password_set",
  UserTwoFactorReset = "user.2fa_reset",
  PartyCreated = "party.created",
  AgreementCreated = "party.agreement_created",
  ShipmentCreated = "shipment.created",
  CustomerInvoiceUpdated = "customer_invoice.updated",
  CustomerInvoiceIssued = "customer_invoice.issued",
  CarrierInvoiceUpdated = "carrier_invoice.updated",
  CarrierInvoiceReceived = "carrier_invoice.received",
  CarrierInvoiceApproved = "carrier_invoice.approved",
}

export enum AuditTargetType {
  User = "user",
  Party = "party",
  Shipment = "shipment",
  CustomerInvoice = "customer_invoice",
  CarrierInvoice = "carrier_invoice",
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
