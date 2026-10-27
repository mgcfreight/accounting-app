// Adding an endpoint: write a typed function in services/ that calls
// apiClient (get/post/put/delete, passing `params` rather than building query
// strings) and checks what comes back with a schema from schemas.ts (via
// parseBody), then call it from the container with useQuery / useMutation.
// Query keys start with the resource name (["users", { page }]) so
// invalidating ["users"] refreshes every view of it.
export {
  ApiError,
  apiClient,
  errorMessage,
  onSessionExpired,
  ResponseShapeError,
} from "./api-client";
export * from "./activity";
export * from "./auth";
export * from "./invoices";
export * from "./parties";
export { queryClient } from "./query-client";
export * from "./roles";
export * from "./settings";
export * from "./shipments";
export * from "./users";
