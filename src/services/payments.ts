import {
  AllocationRule,
  Currency,
  PaymentDirection,
  PaymentMethod,
  PaymentSortBy,
  SortOrder,
} from "@/lib/enums";
import { apiClient, parseBody } from "./api-client";
import {
  allocationSuggestionSchema,
  envelope,
  paginated,
  paymentSchema,
} from "./schemas";

// Shipper payments (money in, /payment/customer) and carrier payments (money
// out, /payment/carrier). Reading needs customer_payments.view /
// carrier_payments.view, recording and allocating *.create, reversing
// *.void; the API answers 403 otherwise. Ids travel as query params.
//
// A payment is recorded once, all of it unapplied, then spread over the
// party's open invoices. Every change sends the payment's `version`: a stale
// screen gets 409 instead of overwriting someone else. Every figure comes
// back calculated — nothing here does arithmetic on money.

const sidePath = (direction: PaymentDirection) =>
  direction === PaymentDirection.In ? "/payment/customer" : "/payment/carrier";

export type PaymentListParams = {
  page: number;
  // At most 100.
  limit: number;
  // Omitted: both sides, as far as the role may see.
  direction?: PaymentDirection;
  // The Unmatched tab: only payments with money not yet allocated.
  unappliedOnly?: boolean;
  // SPAY-12, CPAY-7 or 12, or text in the reference or the party's name.
  searchQuery?: string;
  method?: PaymentMethod;
  // Omitted: newest payment date first.
  sortBy?: PaymentSortBy;
  order?: SortOrder;
};

export type NewPayment = {
  partyId: string;
  // "YYYY-MM-DD", not in the future.
  paymentDate: string;
  // Above zero, 2 decimals.
  amount: string;
  // The party's currency.
  currency: Currency;
  // USD only, e.g. the bank's own rate; left out, the API uses the Bank of
  // Canada's rate for the payment date.
  fxRateToCad?: string;
  method: PaymentMethod;
  reference?: string;
  notes?: string;
  // One per payment being recorded: sending the same key again returns the
  // payment already recorded instead of a second one.
  idempotencyKey: string;
};

export type AllocationLine = {
  invoiceId: string;
  amount: string;
  // The suggestion's rule when a line is kept unchanged; MANUAL otherwise.
  rule?: AllocationRule;
};

const payment = envelope(paymentSchema);

// The API rejects empty query values, so leave out unset ones.
export const listPayments = (params: PaymentListParams, signal?: AbortSignal) =>
  apiClient
    .get("/payment/all", {
      params: {
        page: params.page,
        limit: params.limit,
        direction: params.direction,
        unappliedOnly: params.unappliedOnly || undefined,
        searchQuery: params.searchQuery || undefined,
        method: params.method,
        sortBy: params.sortBy,
        order: params.sortBy ? params.order : undefined,
      },
      signal,
    })
    .then((res) => parseBody(envelope(paginated(paymentSchema)), res.data).data);

// With its allocations and, while money is unapplied, the suggestion.
export const getPayment = (
  direction: PaymentDirection,
  paymentId: string,
  signal?: AbortSignal
) =>
  apiClient
    .get(sidePath(direction), { params: { paymentId }, signal })
    .then((res) => parseBody(payment, res.data).data);

export const recordPayment = (direction: PaymentDirection, body: NewPayment) =>
  apiClient
    .post(sidePath(direction), body)
    .then((res) => parseBody(payment, res.data).data);

// How matching would spread what is unapplied: the invoice number in the
// reference, then an exact amount, then the oldest open invoice.
export const getAllocationSuggestion = (
  direction: PaymentDirection,
  paymentId: string,
  signal?: AbortSignal
) =>
  apiClient
    .get(`${sidePath(direction)}/suggestion`, { params: { paymentId }, signal })
    .then((res) => parseBody(envelope(allocationSuggestionSchema), res.data).data);

// Whatever is not allocated stays on the payment as unapplied credit.
export const allocatePayment = (
  direction: PaymentDirection,
  paymentId: string,
  body: { version: number; allocations: AllocationLine[] }
) =>
  apiClient
    .post(`${sidePath(direction)}/allocate`, body, { params: { paymentId } })
    .then((res) => parseBody(payment, res.data).data);

// The money goes back to the payment's unapplied amount; the invoice owes it
// again. `version` is the payment's.
export const reverseAllocation = (
  direction: PaymentDirection,
  allocationId: string,
  body: { version: number }
) =>
  apiClient
    .put(`${sidePath(direction)}/allocation/reverse`, body, {
      params: { allocationId },
    })
    .then((res) => parseBody(payment, res.data).data);

// A bounced cheque or the wrong party: every allocation is reversed too.
export const reversePayment = (
  direction: PaymentDirection,
  paymentId: string,
  body: { version: number; reason: string }
) =>
  apiClient
    .put(`${sidePath(direction)}/reverse`, body, { params: { paymentId } })
    .then((res) => parseBody(payment, res.data).data);
