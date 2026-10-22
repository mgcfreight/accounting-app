// String values, as the Accounts API will send them — unlike mokal-backend,
// where currency is stored as USD = 1, CAD = 2.

export enum UserRole {
  Admin = "ADMIN",
  Accountant = "ACCOUNTANT",
  Viewer = "VIEWER",
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
