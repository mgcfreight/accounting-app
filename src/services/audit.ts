import { AuditAction, AuditTargetType } from "@/lib/enums";
import { AuditDetails, AuditEventView } from "@/lib/interfaces";
import { apiClient } from "./api-client";
import {
  isNonEmptyString,
  isOneOf,
  isRecord,
  isString,
  isTimestamp,
  orNull,
  parsePage,
  parseShape,
  Parser,
  unwrap,
} from "./parse";

// The audit log (GET /audit/events), newest first. Admin only: it shows
// every user's activity and IP addresses.

export type AuditEventQuery = {
  page: number;
  // At most 100.
  limit: number;
  // Who did it.
  actorId?: string;
  // What it was done to (for user events, the user's id).
  targetId?: string;
  // One sign-in's activity.
  sessionId?: string;
  action?: AuditAction;
};

const isScalar = (value: unknown) =>
  value === null || ["string", "number", "boolean"].includes(typeof value);

// At most two levels deep, e.g. `{ role: { from, to } }`.
const isDetails = (value: unknown): value is AuditDetails =>
  isRecord(value) &&
  Object.values(value).every(
    (field) =>
      isScalar(field) || (isRecord(field) && Object.values(field).every(isScalar))
  );

const parseActor = parseShape<NonNullable<AuditEventView["actor"]>>({
  id: isNonEmptyString,
  firstName: isString,
  lastName: isString,
  email: isString,
});

const parseEventFields = parseShape<Omit<AuditEventView, "actor">>({
  id: isNonEmptyString,
  action: isOneOf(AuditAction),
  sessionId: orNull(isString),
  targetType: orNull(isOneOf(AuditTargetType)),
  targetId: orNull(isString),
  ipAddress: orNull(isString),
  userAgent: orNull(isString),
  details: orNull(isDetails),
  createdAt: isTimestamp,
});

const parseEvent: Parser<AuditEventView> = (value) => {
  const fields = parseEventFields(value);
  if (!fields) return null;
  const rawActor = (value as { actor?: unknown }).actor;
  const actor = rawActor === null ? null : parseActor(rawActor);
  if (rawActor !== null && !actor) return null;
  return { ...fields, actor };
};

export const getAuditEvents = async (
  query: AuditEventQuery,
  signal?: AbortSignal
) =>
  unwrap(
    await apiClient.get("/audit/events", { params: query, signal }),
    parsePage(parseEvent)
  );
