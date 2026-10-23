// Adding an endpoint: write a typed function in services/ that calls
// apiClient (get/post/put/delete, passing `params` rather than building query
// strings) and validates what comes back (parse.ts), then call it from the
// container with useQuery / useMutation. Query keys start with the resource
// name (["invoices", { direction, page }]) so invalidating ["invoices"]
// refreshes every view of it.
export { ApiError, apiClient } from "./api-client";
export { errorMessage } from "./api-error";
export * from "./audit";
export * from "./auth";
export * from "./invoices";
export type { Page } from "./parse";
export * from "./parties";
export { queryClient } from "./query-client";
export { onSessionExpired } from "./session";
export * from "./shipments";
export * from "./users";
