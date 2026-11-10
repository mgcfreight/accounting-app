import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api-client";

// A 4xx fails the same way every time; the server or network may recover.
const isRetryable = (error: unknown) =>
  !(error instanceof ApiError && error.status >= 400 && error.status < 500);

// One client for the app, provided in app/providers.tsx.
//
// Mutations are never retried (TanStack's default, kept on purpose): retrying
// a payment or an invoice change that may have reached the server could apply
// it twice.
//
// Mutations run even when the browser reports offline (`networkMode:
// "always"`), so an offline save fails at once rather than pausing. A paused
// save stays pending — locking FormModal, which can't be closed while saving —
// and fires on its own when the connection returns, possibly long after the
// user has given up on it.
//
// When a refetch fails, TanStack keeps the last data beside the error. A
// screen showing amounts must check `isError` and not present those figures
// as current.
// Every view that shows what is owed or paid. A payment, an allocation, a
// write-off or a credit changes all of them: balances and unapplied credit,
// the dashboard and aging (["accounts", …]), statements, reports, reminders
// and the invoice pages, and installment plans (their paid and remaining
// come from the invoices). Refresh them together, so no screen keeps an old
// amount after a change.
const MONEY_VIEWS = [
  "invoices",
  "payments",
  "accounts",
  "statements",
  "report",
  "reminders",
  "write-offs",
  "disputes",
  "installment-plans",
];

export const refreshMoneyViews = (client: QueryClient) =>
  MONEY_VIEWS.forEach(
    (key) => void client.invalidateQueries({ queryKey: [key] })
  );

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => failureCount < 2 && isRetryable(error),
    },
    mutations: {
      networkMode: "always",
    },
  },
});
