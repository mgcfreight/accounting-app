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
// When a refetch fails, TanStack keeps the last data beside the error. A
// screen showing amounts must check `isError` and not present those figures
// as current.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => failureCount < 2 && isRetryable(error),
    },
  },
});
