export const LOGIN_PATH = "/login/";
export const HOME_PATH = "/dashboard/";

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
