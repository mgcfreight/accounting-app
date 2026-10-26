import { SessionStatus } from "@/lib/enums";
import { apiClient, parseBody } from "./api-client";
import {
  auditEventSchema,
  envelope,
  messageOnly,
  paginated,
  sessionSchema,
} from "./schemas";

// Sign-in sessions and the audit log. The API scopes both by role: an Admin
// gets everyone's, any other role only their own — asking for someone else's
// is refused with a 403 — so these never decide what a caller may see.

export type SessionListParams = {
  page: number;
  limit: number;
  userId?: string;
  status?: SessionStatus;
};

export const listSessions = (params: SessionListParams, signal?: AbortSignal) =>
  apiClient
    .get("/sessions", { params, signal })
    .then(
      (res) => parseBody(envelope(paginated(sessionSchema)), res.data).data
    );

// Marks the session REVOKED and signs its user out. An Admin can end anyone's
// active session; other roles only their own (the API refuses the rest).
export const endSession = (sessionId: string) =>
  apiClient
    .post("/sessions/end", undefined, { params: { sessionId } })
    .then((res) => parseBody(messageOnly, res.data).message);

export type AuditListParams = {
  page: number;
  limit: number;
  actorId?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  // Timestamp bounds (ISO), inclusive.
  from?: string;
  to?: string;
};

export const listAuditEvents = (
  params: AuditListParams,
  signal?: AbortSignal
) =>
  apiClient
    .get("/audit/events", {
      // The API rejects empty query values, so drop unset filters.
      params: Object.fromEntries(
        Object.entries(params).filter(
          ([, value]) => value !== "" && value !== undefined
        )
      ),
      signal,
    })
    .then(
      (res) => parseBody(envelope(paginated(auditEventSchema)), res.data).data
    );
