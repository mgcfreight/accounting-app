import { SyncInboxStatus } from "@/lib/enums";
import { apiClient, parseBody } from "./api-client";
import {
  envelope,
  paginated,
  syncEventSchema,
  syncRunSchema,
  syncStatusSchema,
} from "./schemas";

// The TMS sync (/sync). Admin only: the API answers 403 to anyone else.
// "Sync now" answers 503 when the server has the sync turned off, and 409
// while another run holds it.

export type SyncEventListParams = {
  page: number;
  // At most 100.
  limit: number;
  status?: SyncInboxStatus;
};

export const getSyncStatus = (signal?: AbortSignal) =>
  apiClient
    .get("/sync/status", { signal })
    .then((res) => parseBody(envelope(syncStatusSchema), res.data).data);

// Pulls new TMS changes and applies everything waiting; returns what it did.
export const runSync = () =>
  apiClient
    .post("/sync/run")
    .then((res) => parseBody(envelope(syncRunSchema), res.data).data);

// Newest first.
export const listSyncEvents = (
  params: SyncEventListParams,
  signal?: AbortSignal
) =>
  apiClient
    .get("/sync/events", { params, signal })
    .then(
      (res) => parseBody(envelope(paginated(syncEventSchema)), res.data).data
    );

// Applies one held (FAILED) event again; returns it with its new status.
export const retrySyncEvent = (eventId: string) =>
  apiClient
    .put("/sync/events/retry", { eventId })
    .then((res) => parseBody(envelope(syncEventSchema), res.data).data);
