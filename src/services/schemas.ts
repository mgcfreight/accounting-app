import { z } from "zod";
import {
  Permission,
  SessionEndReason,
  SessionStatus,
  SignInStep,
  TwoFactorMethod,
} from "@/lib/enums";
import {
  AccountingPeriod,
  AuditEvent,
  ChargeType,
  CompanySettings,
  Me,
  NoticeSettings,
  Paginated,
  PermissionCatalog,
  Role,
  RoleRef,
  SettingsEditor,
  TaxRate,
  User,
  UserRef,
  UserSession,
} from "@/lib/interfaces";

// Every API response is untrusted input (security.md): each service function
// parses what came back with one of these before a screen sees it. A response
// that doesn't match throws, so a screen shows an error instead of guessing.
//
// Each schema is typed against the interface in lib/interfaces, so the two
// can't drift apart without a type error.

const timestamp = z.iso.datetime({ offset: true });
const calendarDate = z.iso.date();
// tax_rates.rate_percent, e.g. "13.000". Kept as text: never parsed.
const percentText = z.string().regex(/^\d{1,3}(\.\d{1,3})?$/);

// { message, data } — the envelope every Accounts API response uses.
export const envelope = <T extends z.ZodType>(data: T) =>
  z.object({ message: z.string(), data });

export const messageOnly = z.object({ message: z.string() });

const paginationMeta = z.object({
  totalItems: z.number().int().nonnegative(),
  itemCount: z.number().int().nonnegative(),
  itemsPerPage: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
  currentPage: z.number().int().positive(),
});

export const paginated = <T>(item: z.ZodType<T>): z.ZodType<Paginated<T>> =>
  z.object({ items: z.array(item), meta: paginationMeta });

const roleRefSchema: z.ZodType<RoleRef> = z.object({
  id: z.string(),
  name: z.string(),
  isSystem: z.boolean(),
});

// Only permissions this build knows are kept, so one the API adds later
// doesn't fail parsing; an unknown one gates nothing here anyway.
const KNOWN_PERMISSIONS = new Set<string>(Object.values(Permission));
const permissionsSchema = z
  .array(z.string())
  .transform((values) =>
    values.filter((value): value is Permission => KNOWN_PERMISSIONS.has(value))
  );

export const userSchema: z.ZodType<User> = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  role: roleRefSchema,
  isEnabled: z.boolean(),
  twoFactorEnabled: z.boolean(),
  lastLoginAt: timestamp.nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

export const meSchema: z.ZodType<Me> = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  role: roleRefSchema,
  isAdmin: z.boolean(),
  permissions: permissionsSchema,
  isEnabled: z.boolean(),
  twoFactorEnabled: z.boolean(),
  lastLoginAt: timestamp.nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
  recoveryCodesRemaining: z.number().int().nonnegative(),
  twoFactor: z.object({
    authenticatorSetUp: z.boolean(),
    canTurnOff: z.boolean(),
    availableMethods: z.array(z.enum(TwoFactorMethod)),
  }),
});

const userRefSchema: z.ZodType<UserRef> = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
});

export const sessionSchema: z.ZodType<UserSession> = z.object({
  id: z.string(),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  browser: z.string().nullable(),
  os: z.string().nullable(),
  deviceType: z.string().nullable(),
  deviceName: z.string().nullable(),
  startedAt: timestamp,
  lastSeenAt: timestamp,
  expiresAt: timestamp,
  endedAt: timestamp.nullable(),
  endReason: z.enum(SessionEndReason).nullable(),
  status: z.enum(SessionStatus),
  durationSeconds: z.number().int().nonnegative(),
  isCurrent: z.boolean(),
  user: userRefSchema.nullable(),
});

export const auditEventSchema: z.ZodType<AuditEvent> = z.object({
  id: z.string(),
  action: z.string(),
  actor: userRefSchema.nullable(),
  sessionId: z.string().nullable(),
  targetType: z.string().nullable(),
  targetId: z.string().nullable(),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  details: z.record(z.string(), z.unknown()).nullable(),
  createdAt: timestamp,
});

// Sign-in. The session itself is the API's httpOnly cookies: no response here
// carries a token, and none is ever read in the browser.
export const signedInSchema = z.object({
  user: userSchema,
  recoveryCodesRemaining: z.number().int().nonnegative(),
});

export const loginResultSchema = z.discriminatedUnion("nextStep", [
  z.object({ nextStep: z.literal(SignInStep.SignedIn), user: userSchema }),
  z.object({
    nextStep: z.enum([SignInStep.TwoFactor, SignInStep.TwoFactorSetup]),
    challengeToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    expiresAt: timestamp,
    methods: z.array(z.enum(TwoFactorMethod)),
  }),
]);

// The QR code is rendered as an <img src>, so only a PNG data URL is allowed
// (security.md: validate URLs before using them in src).
export const authenticatorSetupSchema = z.object({
  secret: z.string().min(1),
  otpauthUrl: z.string().startsWith("otpauth://"),
  qrCodeDataUrl: z.string().regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/),
});

export const recoveryCodesSchema = z.object({
  recoveryCodes: z.array(z.string()).min(1),
});

export const emailCodeSentSchema = z.object({
  sentTo: z.string(),
  expiresAt: timestamp,
});

const settingsEditorSchema: z.ZodType<SettingsEditor> = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
});

export const companySettingsSchema: z.ZodType<CompanySettings> = z.object({
  legalName: z.string().nullable(),
  gstHstNumber: z.string().nullable(),
  addressLine1: z.string().nullable(),
  addressLine2: z.string().nullable(),
  city: z.string().nullable(),
  province: z.string().nullable(),
  postalCode: z.string().nullable(),
  country: z.string().nullable(),
  accountsNotificationEmail: z.string().nullable(),
  updatedAt: timestamp.nullable(),
  updatedBy: settingsEditorSchema.nullable(),
});

const noticeDays = z.number().int().min(0).max(30);

export const noticeSettingsSchema: z.ZodType<NoticeSettings> = z.object({
  defaultNoticeDays: z.object({
    NET_7: noticeDays,
    NET_15: noticeDays,
    NET_30: noticeDays,
    NET_60: noticeDays,
  }),
  carrierAlertDaysBefore: z.number().int().min(0).max(60).nullable(),
  updatedAt: timestamp.nullable(),
  updatedBy: settingsEditorSchema.nullable(),
});

export const accountingPeriodSchema: z.ZodType<AccountingPeriod> = z.object({
  id: z.string(),
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  status: z.enum(["OPEN", "CLOSED"]),
  closedAt: timestamp.nullable(),
  closedBy: settingsEditorSchema.nullable(),
  updatedAt: timestamp,
});

export const taxRateSchema: z.ZodType<TaxRate> = z.object({
  id: z.string(),
  code: z.string(),
  jurisdiction: z.string(),
  name: z.string(),
  ratePercent: percentText,
  effectiveFrom: calendarDate,
  effectiveTo: calendarDate.nullable(),
  isRecoverable: z.boolean(),
  createdAt: timestamp,
});

export const chargeTypeSchema: z.ZodType<ChargeType> = z.object({
  code: z.string(),
  name: z.string(),
  mgcCode: z.string().nullable(),
  defaultTaxable: z.boolean(),
  isActive: z.boolean(),
});

export const roleSchema: z.ZodType<Role> = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  isSystem: z.boolean(),
  isAdmin: z.boolean(),
  permissionsEditable: z.boolean(),
  permissions: permissionsSchema,
  userCount: z.number().int().nonnegative(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

// A catalog entry for a permission this build doesn't know is dropped: it
// couldn't gate anything here, and the API would still accept it unsent.
export const permissionCatalogSchema: z.ZodType<PermissionCatalog> =
  z.object({
    modules: z.array(
      z.object({
        module: z.string(),
        label: z.string(),
        description: z.string(),
        actions: z.array(
          z.object({ action: z.string(), label: z.string(), permission: z.string() })
        ),
      })
    ),
    actions: z.array(z.object({ action: z.string(), label: z.string() })),
  }).transform(({ modules, actions }) => ({
    actions,
    modules: modules.map((row) => ({
      ...row,
      actions: row.actions.filter(
        (cell): cell is (typeof cell & { permission: Permission }) =>
          KNOWN_PERMISSIONS.has(cell.permission)
      ),
    })),
  }));
