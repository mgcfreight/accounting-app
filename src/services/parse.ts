import { AxiosResponse } from "axios";
import { SessionEndReason, SessionStatus, UserRole } from "@/lib/enums";
import { SessionView, User } from "@/lib/interfaces";
import { isMoneyString } from "@/lib/money";
import { PaginationMeta } from "@/lib/types";
import { ApiError } from "./api-error";
import { Tokens } from "./session";

// Checks for what the Accounts API sends back. A response is untrusted input
// (security.md): each parser returns null for a shape it doesn't expect, and
// `unwrap` turns that into an ApiError, so a screen never renders half a
// record. Hand-written because the repo has no schema library yet.

export type Parser<T> = (value: unknown) => T | null;

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isString = (value: unknown): value is string =>
  typeof value === "string";

export const isNonEmptyString = (value: unknown): value is string =>
  isString(value) && value.length > 0;

export const isCount = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 0;

export const isOneOf =
  <T extends string>(values: Record<string, T>) =>
  (value: unknown): value is T =>
    Object.values(values).includes(value as T);

// `check`, or null.
export const orNull =
  <T>(check: (value: unknown) => value is T) =>
  (value: unknown): value is T | null =>
    value === null || check(value);

// A 2-decimal amount, as lib/money.ts formats it. Anything else fails the
// whole record rather than showing a wrong figure.
export const isMoney = isMoneyString;

// A quantity, unit price, FX or tax rate: digits with their own precision.
export const isDecimal = (value: unknown): value is string =>
  isString(value) && /^-?\d+(\.\d+)?$/.test(value);

// A calendar date, "2026-10-14".
export const isDateOnly = (value: unknown): value is string =>
  isString(value) && /^\d{4}-\d{2}-\d{2}$/.test(value);

// An ISO timestamp.
export const isTimestamp = (value: unknown): value is string =>
  isString(value) && !Number.isNaN(Date.parse(value));

export const isUserRole = isOneOf(UserRole);

// Every endpoint answers `{ message, data }`; this returns `data`, checked.
export const unwrap = <T>(res: AxiosResponse, parse: Parser<T>): T => {
  const data = isRecord(res.data) ? parse(res.data.data) : null;
  if (data === null) {
    throw new ApiError(
      "The server sent a response this app can't read.",
      res.status,
      res.data
    );
  }
  return data;
};

export const parseUser: Parser<User> = (value) => {
  if (!isRecord(value)) return null;
  const {
    id,
    firstName,
    lastName,
    email,
    role,
    isEnabled,
    twoFactorEnabled,
    lastLoginAt,
    createdAt,
    updatedAt,
  } = value;
  if (
    !isNonEmptyString(id) ||
    !isString(firstName) ||
    !isString(lastName) ||
    !isNonEmptyString(email) ||
    !isUserRole(role) ||
    typeof isEnabled !== "boolean" ||
    typeof twoFactorEnabled !== "boolean" ||
    !(lastLoginAt === null || isString(lastLoginAt)) ||
    !isString(createdAt) ||
    !isString(updatedAt)
  ) {
    return null;
  }
  return {
    id,
    firstName,
    lastName,
    email,
    role,
    isEnabled,
    twoFactorEnabled,
    lastLoginAt,
    createdAt,
    updatedAt,
  };
};

export const parseTokens: Parser<Tokens> = (value) => {
  if (!isRecord(value)) return null;
  const { access_token, refresh_token } = value;
  if (!isNonEmptyString(access_token) || !isNonEmptyString(refresh_token)) {
    return null;
  }
  return { accessToken: access_token, refreshToken: refresh_token };
};

export const parseStrings: Parser<string[]> = (value) =>
  Array.isArray(value) && value.every(isNonEmptyString) ? value : null;

export const parseCount: Parser<number> = (value) =>
  isCount(value) ? value : null;

// A list of `parse`; null if any item fails, rather than silently dropping it.
export const parseList =
  <T>(parse: Parser<T>): Parser<T[]> =>
  (value) => {
    if (!Array.isArray(value)) return null;
    const items = value.map(parse);
    return items.every((item) => item !== null) ? (items as T[]) : null;
  };

export type Page<T> = { items: T[]; meta: PaginationMeta };

export const parsePage =
  <T>(parse: Parser<T>): Parser<Page<T>> =>
  (value) => {
    if (!isRecord(value) || !isRecord(value.meta)) return null;
    const items = parseList(parse)(value.items);
    const { totalItems, itemCount, itemsPerPage, totalPages, currentPage } =
      value.meta;
    if (
      items === null ||
      !isCount(totalItems) ||
      !isCount(itemCount) ||
      !isCount(itemsPerPage) ||
      !isCount(totalPages) ||
      !isCount(currentPage)
    ) {
      return null;
    }
    return {
      items,
      meta: { totalItems, itemCount, itemsPerPage, totalPages, currentPage },
    };
  };

// One check per field of T. Every key must be listed, so a field added to an
// interface can't go unchecked.
export type Shape<T> = { [K in keyof T]-?: (value: unknown) => boolean };

// Copies exactly the fields in `shape`, each checked; null if any fails.
// Nested records and lists are parsed by the caller and spread on top.
export const parseShape =
  <T>(shape: Shape<T>): Parser<T> =>
  (value) => {
    if (!isRecord(value)) return null;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(shape) as (keyof T & string)[]) {
      if (!shape[key](value[key])) return null;
      result[key] = value[key];
    }
    return result as T;
  };

// For an optional nested field: undefined stays undefined, anything else must
// parse. Returns null only on a failed parse.
export const parseOptional = <T>(
  parse: Parser<T>,
  value: unknown
): T | undefined | null => (value === undefined ? undefined : parse(value));

// One sign-in, from /auth/sessions and /user/sessions.
export const parseSession = parseShape<SessionView>({
  id: isNonEmptyString,
  ipAddress: orNull(isString),
  userAgent: orNull(isString),
  browser: orNull(isString),
  os: orNull(isString),
  deviceType: orNull(isString),
  deviceName: orNull(isString),
  startedAt: isTimestamp,
  lastSeenAt: isTimestamp,
  expiresAt: isTimestamp,
  endedAt: orNull(isTimestamp),
  endReason: orNull(isOneOf(SessionEndReason)),
  status: isOneOf(SessionStatus),
  durationSeconds: isCount,
  isCurrent: (value) => typeof value === "boolean",
});
