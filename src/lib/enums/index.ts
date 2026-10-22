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
