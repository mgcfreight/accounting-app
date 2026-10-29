import { PartyType } from "@/lib/enums";
import { apiClient, parseBody } from "./api-client";
import {
  accountSummarySchema,
  agingSchema,
  dashboardSchema,
  envelope,
  paginated,
} from "./schemas";

// Balances, aging and the dashboard's figures (/account). Any signed-in user
// may call these, but each side comes back only when the role may view its
// invoices: receivables with customer_invoices.view, payables with
// carrier_invoices.view. A hidden section is null; a role that may see
// neither gets 403. Every figure is calculated by the API.

export type AccountSummaryListParams = {
  page: number;
  // At most 100.
  limit: number;
  // Omitted: both, as far as the role may see.
  type?: PartyType;
  // Part of the party's name.
  searchQuery?: string;
  isActive?: boolean;
};

export const getDashboard = (signal?: AbortSignal) =>
  apiClient
    .get("/account/dashboard", { signal })
    .then((res) => parseBody(envelope(dashboardSchema), res.data).data);

// Current, 1-30, 31-60, 61-90 and 90+ days past due, per currency; an open
// dispute's amount is in Disputed, not its age bucket.
export const getAging = (signal?: AbortSignal) =>
  apiClient
    .get("/account/aging", { signal })
    .then((res) => parseBody(envelope(agingSchema), res.data).data);

// Shippers and carriers with their account figures, ordered by name.
export const listAccountSummaries = (
  params: AccountSummaryListParams,
  signal?: AbortSignal
) =>
  apiClient
    .get("/account/summaries", {
      params: {
        page: params.page,
        limit: params.limit,
        type: params.type,
        searchQuery: params.searchQuery || undefined,
        isActive: params.isActive,
      },
      signal,
    })
    .then(
      (res) =>
        parseBody(envelope(paginated(accountSummarySchema)), res.data).data
    );
