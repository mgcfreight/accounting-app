import { apiClient, parseBody } from "./api-client";
import {
  envelope,
  exchangeRateRefreshSchema,
  exchangeRateSchema,
  paginated,
} from "./schemas";

// The Bank of Canada's daily USD rate to CAD (/exchange-rate). Any signed-in
// user may read the rates; fetching now is Admin only. The API fetches them
// itself every day at 17:30 Toronto time, and answers 409 while a fetch is
// running and 502 when the Bank can't be reached.

export type ExchangeRateListParams = {
  page: number;
  // At most 100.
  limit: number;
  // "YYYY-MM-DD", both optional.
  from?: string;
  to?: string;
};

// Newest first, one row per calendar day. The API rejects empty query
// values, so leave out unset ones.
export const listExchangeRates = (
  params: ExchangeRateListParams,
  signal?: AbortSignal
) =>
  apiClient
    .get("/exchange-rate/all", {
      params: {
        page: params.page,
        limit: params.limit,
        from: params.from || undefined,
        to: params.to || undefined,
      },
      signal,
    })
    .then((res) =>
      parseBody(envelope(paginated(exchangeRateSchema)), res.data).data
    );

// Stores the days missing, then fills USD invoices, carrier bills and
// payments that have no rate. A rate typed in by staff is never replaced.
export const fetchExchangeRates = () =>
  apiClient
    .post("/exchange-rate/fetch")
    .then((res) => parseBody(envelope(exchangeRateRefreshSchema), res.data).data);
