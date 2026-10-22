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
