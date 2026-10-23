import {
  AuditAction,
  BillingTrigger,
  InvoiceReviewFlag,
  PaymentTerms,
  TaxBasis,
  TaxTreatment,
} from "../enums";

export const LOGIN_PATH = "/login/";
export const HOME_PATH = "/dashboard/";
export const FORGOT_PASSWORD_PATH = "/forgot-password/";
// The API's reset email links here, adding `?token=…`.
export const RESET_PASSWORD_PATH = "/reset-password/";

// The Accounts API's input rules (its RegexConstants), so a form can say
// what's wrong before sending. The API checks again.
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PERSON_NAME_PATTERN = /^\p{L}[\p{L} '.-]*$/u;
export const PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[\x20-\x7E]{12,64}$/;
export const PASSWORD_RULE =
  "12-64 characters, with an upper-case letter, a lower-case letter and a number.";
// A code from an authenticator app or an email.
export const SIX_DIGIT_CODE_PATTERN = /^\d{6}$/;
// What the sign-in code field takes: an app code or a recovery code.
export const SIGN_IN_CODE_PATTERN = /^(\d{6}|[a-z2-7]{5}-?[a-z2-7]{5})$/i;
export const RESET_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export const PAGE_SIZES = [10, 20, 30];

export const duration = [
  { key: "1", label: "Today", value: 1 },
  { key: "2", label: "This Week", value: 2 },
  { key: "3", label: "This Month", value: 3 },
  { key: "4", label: "This Quarter", value: 4 },
];

export const currencyOptions = [
  { key: "CAD", label: "CAD", value: "CAD" },
  { key: "USD", label: "USD", value: "USD" },
];

export const paymentMethodOptions = [
  { key: "CARD", label: "Card (Stripe)", value: "CARD" },
  { key: "E_TRANSFER", label: "e-Transfer", value: "E_TRANSFER" },
  { key: "EFT", label: "EFT", value: "EFT" },
  { key: "CHEQUE", label: "Cheque", value: "CHEQUE" },
  { key: "WIRE", label: "Wire", value: "WIRE" },
  { key: "CASH", label: "Cash", value: "CASH" },
];

export const paymentMethodLabel = (method: string) =>
  paymentMethodOptions.find((option) => option.key === method)?.label ?? method;

export const chargeKindOptions = [
  { key: "FUEL", label: "Fuel surcharge", value: "FUEL" },
  { key: "DETENTION", label: "Detention", value: "DETENTION" },
  { key: "ACCESSORIAL", label: "Accessorial", value: "ACCESSORIAL" },
  {
    key: "CANCELLATION_FEE",
    label: "Cancellation fee",
    value: "CANCELLATION_FEE",
  },
  { key: "OTHER", label: "Other", value: "OTHER" },
];

// ---------------------------------------------------------------------------
// Labels and options for the Accounts API's invoicing values.


const optionsFrom = <T extends string>(labels: Record<T, string>) =>
  (Object.entries(labels) as [T, string][]).map(([value, label]) => ({
    key: value,
    label,
    value,
  }));

export const paymentTermsLabels: Record<PaymentTerms, string> = {
  [PaymentTerms.COD]: "COD",
  [PaymentTerms.Prepaid]: "Prepaid",
  [PaymentTerms.Net7]: "Net 7",
  [PaymentTerms.Net15]: "Net 15",
  [PaymentTerms.Net30]: "Net 30",
  [PaymentTerms.Net60]: "Net 60",
};
export const paymentTermsOptions = optionsFrom(paymentTermsLabels);

export const taxTreatmentLabels: Record<TaxTreatment, string> = {
  [TaxTreatment.Standard]: "Standard",
  [TaxTreatment.ZeroRated]: "Zero-rated",
  [TaxTreatment.Exempt]: "Exempt",
};
export const taxTreatmentOptions = optionsFrom(taxTreatmentLabels);

export const taxBasisLabels: Record<TaxBasis, string> = {
  [TaxBasis.BillTo]: "Bill-to address",
  [TaxBasis.Destination]: "Shipment destination",
};
export const taxBasisOptions = optionsFrom(taxBasisLabels);

export const billingTriggerLabels: Record<BillingTrigger, string> = {
  [BillingTrigger.Prepaid]: "Prepaid",
  [BillingTrigger.COD]: "COD",
  [BillingTrigger.OnShipmentCreated]: "Bills when the shipment is booked",
  [BillingTrigger.OnDeliveryWithPod]: "Bills on delivery, with POD",
};
export const billingTriggerOptions = optionsFrom(billingTriggerLabels);

export const reviewFlagLabels: Record<InvoiceReviewFlag, string> = {
  [InvoiceReviewFlag.TermsMismatch]:
    "The TMS payment terms differ from the agreement",
  [InvoiceReviewFlag.NoReferenceNumber]:
    "No reference number (BOL, pickup, PO, SO, PRO, quote or bill)",
  [InvoiceReviewFlag.NoTmsCode]: "No TMS invoice code, so no invoice number",
  [InvoiceReviewFlag.NoFxRate]: "A USD invoice without a rate to CAD",
};

export const auditActionLabels: Record<AuditAction, string> = {
  [AuditAction.SignedIn]: "Signed in",
  [AuditAction.SignInFailed]: "Sign-in failed",
  [AuditAction.TwoFactorCodeRejected]: "2FA code rejected",
  [AuditAction.AccountLocked]: "Account locked",
  [AuditAction.SignedOut]: "Signed out",
  [AuditAction.RefreshTokenReused]: "Session token reused",
  [AuditAction.PasswordChanged]: "Password changed",
  [AuditAction.PasswordResetRequested]: "Password reset requested",
  [AuditAction.PasswordReset]: "Password reset",
  [AuditAction.TwoFactorEnabled]: "2FA turned on",
  [AuditAction.TwoFactorDisabled]: "2FA turned off",
  [AuditAction.TwoFactorEmailCodeSent]: "2FA email code sent",
  [AuditAction.RecoveryCodesRegenerated]: "Recovery codes replaced",
  [AuditAction.UserCreated]: "User added",
  [AuditAction.UserUpdated]: "User changed",
  [AuditAction.UserEnabled]: "User enabled",
  [AuditAction.UserDisabled]: "User disabled",
  [AuditAction.UserPasswordSet]: "User password set",
  [AuditAction.UserTwoFactorReset]: "User 2FA reset",
  [AuditAction.PartyCreated]: "Party added",
  [AuditAction.AgreementCreated]: "Agreement added",
  [AuditAction.ShipmentCreated]: "Shipment entered",
  [AuditAction.CustomerInvoiceUpdated]: "Customer invoice changed",
  [AuditAction.CustomerInvoiceIssued]: "Customer invoice issued",
  [AuditAction.CarrierInvoiceUpdated]: "Carrier invoice changed",
  [AuditAction.CarrierInvoiceReceived]: "Carrier bill entered",
  [AuditAction.CarrierInvoiceApproved]: "Carrier invoice approved",
};

// The codes the API accepts for a Canadian address (its CANADIAN_PROVINCES).
export const CANADIAN_PROVINCES = [
  "AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT",
];

// The API's input rules for invoicing (its RegexConstants).
export const TMS_INVOICE_CODE_PATTERN = /^[A-Za-z0-9]{6}$/;
export const FX_RATE_PATTERN = /^(?!0+(\.0+)?$)\d{1,6}(\.\d{1,6})?$/;
export const QUANTITY_PATTERN = /^(?!0+(\.0+)?$)\d{1,9}(\.\d{1,3})?$/;
export const UNIT_PRICE_PATTERN = /^\d{1,10}(\.\d{1,4})?$/;
export const COUNTRY_PATTERN = /^[A-Z]{2}$/;
export const REGION_PATTERN = /^[A-Z]{2,3}$/;
