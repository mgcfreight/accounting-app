import { BillingPeriodStatus } from "@/lib/enums";
import { apiClient, parseBody } from "./api-client";
import {
  billingPeriodDetailSchema,
  billingPeriodRunSchema,
  billingPeriodSchema,
  envelope,
  paginated,
} from "./schemas";

// Shippers' billing periods (/billing-period): a NET-terms shipper's
// invoices are grouped into periods, with a notice before each one ends.
// Reading needs customer_invoices.view; running the daily job now also
// reports.send_email. The API answers 409 while the job is running.

export type BillingPeriodListParams = {
  page: number;
  // At most 100.
  limit: number;
  partyId?: string;
  status?: BillingPeriodStatus;
};

// Newest first. The API rejects empty query values, so leave out unset ones.
export const listBillingPeriods = (
  params: BillingPeriodListParams,
  signal?: AbortSignal
) =>
  apiClient
    .get("/billing-period/all", {
      params: {
        page: params.page,
        limit: params.limit,
        partyId: params.partyId || undefined,
        status: params.status,
      },
      signal,
    })
    .then((res) =>
      parseBody(envelope(paginated(billingPeriodSchema)), res.data).data
    );

// With its invoices.
export const getBillingPeriod = (billingPeriodId: string, signal?: AbortSignal) =>
  apiClient
    .get("/billing-period", { params: { billingPeriodId }, signal })
    .then((res) => parseBody(envelope(billingPeriodDetailSchema), res.data).data);

// Sends any notice that failed or is due, closes ended periods and places
// new issued invoices in their period; returns what it did.
export const runBillingPeriods = () =>
  apiClient
    .post("/billing-period/run")
    .then((res) => parseBody(envelope(billingPeriodRunSchema), res.data).data);
