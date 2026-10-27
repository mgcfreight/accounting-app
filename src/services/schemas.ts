import { z } from "zod";
import {
  AdjustmentMode,
  BillingTrigger,
  CarrierInvoiceStatus,
  Currency,
  CustomerInvoiceStatus,
  InvoiceKind,
  InvoiceReviewFlag,
  PartyType,
  PaymentStatus,
  PaymentTerms,
  Permission,
  SessionEndReason,
  SessionStatus,
  ShipmentSource,
  SignInStep,
  TaxBasis,
  TaxTreatment,
  TwoFactorMethod,
} from "@/lib/enums";
import {
  AccountingPeriod,
  AgreementView,
  AuditEvent,
  CarrierInvoiceView,
  ChargeType,
  CompanySettings,
  CustomerInvoiceView,
  InvoiceBillTo,
  InvoiceChargeType,
  InvoiceLineView,
  InvoiceTax,
  Me,
  NoticeSettings,
  Paginated,
  PartyView,
  PermissionCatalog,
  Role,
  RoleRef,
  SettingsEditor,
  ShipmentView,
  TaxRate,
  User,
  UserRef,
  UserSession,
} from "@/lib/interfaces";
import { isMoneyString } from "@/lib/money";

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
// A 2-decimal amount, as lib/money.ts formats it. Anything else fails the
// whole record rather than showing a wrong figure.
const money = z.string().refine(isMoneyString, "Not a 2-decimal amount");
// A quantity, unit price or rate: digits with their own precision.
const decimalText = z.string().regex(/^-?\d+(\.\d+)?$/);

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

// ---------------------------------------------------------------- parties

export const agreementSchema: z.ZodType<AgreementView> = z.object({
  id: z.string(),
  partyId: z.string(),
  paymentTerms: z.enum(PaymentTerms),
  currency: z.enum(Currency),
  taxTreatment: z.enum(TaxTreatment),
  taxBasis: z.enum(TaxBasis),
  billingTrigger: z.enum(BillingTrigger).nullable(),
  noticeDaysBefore: z.number().int().nonnegative().nullable(),
  alertDaysBefore: z.number().int().nonnegative().nullable(),
  defaultAdjustmentMode: z.enum(AdjustmentMode),
  autoSendInvoices: z.boolean(),
  billingNoticeEnabled: z.boolean(),
  remindersEnabled: z.boolean(),
  weeklyStatementEnabled: z.boolean(),
  effectiveFrom: calendarDate,
  effectiveTo: calendarDate.nullable(),
  notes: z.string().nullable(),
  createdAt: timestamp,
});

export const partySchema: z.ZodType<PartyView> = z.object({
  id: z.string(),
  type: z.enum(PartyType),
  mgcId: z.string(),
  name: z.string(),
  legalName: z.string().nullable(),
  gstHstNumber: z.string().nullable(),
  addressLine1: z.string().nullable(),
  addressLine2: z.string().nullable(),
  city: z.string().nullable(),
  province: z.string().nullable(),
  postalCode: z.string().nullable(),
  country: z.string(),
  defaultCurrency: z.enum(Currency),
  isActive: z.boolean(),
  createdAt: timestamp,
  updatedAt: timestamp,
  agreements: z.array(agreementSchema).optional(),
});

// ------------------------------------------------------------- shipments

const referenceNumberFields = {
  bolNumber: z.string().nullable(),
  pickupNumber: z.string().nullable(),
  poNumber: z.string().nullable(),
  soNumber: z.string().nullable(),
  proNumber: z.string().nullable(),
  quoteNumber: z.string().nullable(),
  billNumber: z.string().nullable(),
};

export const shipmentSchema: z.ZodType<ShipmentView> = z.object({
  ...referenceNumberFields,
  id: z.string(),
  mgcShipmentId: z.string(),
  loadNumber: z.string(),
  source: z.enum(ShipmentSource),
  shipperPartyId: z.string(),
  carrierPartyId: z.string().nullable(),
  tmsStatus: z.string(),
  tmsPaymentTerms: z.enum(PaymentTerms),
  invoiceSequence: z.string().nullable(),
  tmsCustomerInvoiceCode: z.string().nullable(),
  tmsCarrierInvoiceCode: z.string().nullable(),
  originCity: z.string().nullable(),
  originProvince: z.string().nullable(),
  originCountry: z.string().nullable(),
  destinationCity: z.string().nullable(),
  destinationProvince: z.string().nullable(),
  destinationCountry: z.string().nullable(),
  pickupDate: calendarDate.nullable(),
  deliveryDate: calendarDate.nullable(),
  sellCurrency: z.enum(Currency),
  sellTotal: money,
  buyCurrency: z.enum(Currency).nullable(),
  buyTotal: money.nullable(),
  mgcCreatedAt: timestamp,
  createdAt: timestamp,
});

// -------------------------------------------------------------- invoices

export const invoiceChargeTypeSchema: z.ZodType<InvoiceChargeType> = z.object(
  { code: z.string(), name: z.string(), defaultTaxable: z.boolean() }
);

const invoiceLineSchema: z.ZodType<InvoiceLineView> = z.object({
  id: z.string(),
  lineNo: z.number().int().nonnegative(),
  chargeTypeCode: z.string(),
  description: z.string(),
  quantity: decimalText,
  unitPrice: decimalText,
  amount: money,
  isTaxable: z.boolean(),
  mgcChargeId: z.string().nullable(),
});

const invoiceTaxSchema: z.ZodType<InvoiceTax> = z.object({
  tax_rate_id: z.string(),
  code: z.string(),
  jurisdiction: z.string(),
  rate_percent: decimalText,
  taxable_amount: money,
  tax_amount: money,
});

const invoiceBillToSchema: z.ZodType<InvoiceBillTo> = z.object({
  name: z.string(),
  legal_name: z.string().nullable(),
  gst_hst_number: z.string().nullable(),
  address_line1: z.string().nullable(),
  address_line2: z.string().nullable(),
  city: z.string().nullable(),
  province: z.string().nullable(),
  postal_code: z.string().nullable(),
  country: z.string(),
});

const invoiceBaseFields = {
  ...referenceNumberFields,
  id: z.string(),
  tmsInvoiceCode: z.string().nullable(),
  sequenceValue: z.string().nullable(),
  suffix: z.string(),
  kind: z.enum(InvoiceKind),
  shipmentId: z.string().nullable(),
  agreementId: z.string(),
  paymentStatus: z.enum(PaymentStatus),
  currency: z.enum(Currency),
  fxRateToCad: decimalText.nullable(),
  paymentTerms: z.enum(PaymentTerms),
  invoiceDate: calendarDate.nullable(),
  dueDate: calendarDate.nullable(),
  taxBasis: z.enum(TaxBasis),
  taxJurisdiction: z.string(),
  subtotal: money,
  taxes: z.array(invoiceTaxSchema),
  taxTotal: money,
  total: money,
  amountPaid: money,
  balanceDue: money,
  notes: z.string().nullable(),
  reviewFlags: z.array(z.enum(InvoiceReviewFlag)),
  parentInvoiceId: z.string().nullable(),
  revision: z.number().int().nonnegative(),
  revisionReason: z.string().nullable(),
  supersededAt: timestamp.nullable(),
  version: z.number().int().positive(),
  createdAt: timestamp,
  updatedAt: timestamp,
  lines: z.array(invoiceLineSchema).optional(),
};

export const customerInvoiceSchema: z.ZodType<CustomerInvoiceView> = z.object({
  ...invoiceBaseFields,
  invoiceNumber: z.string().nullable(),
  customerId: z.string(),
  status: z.enum(CustomerInvoiceStatus),
  billTo: invoiceBillToSchema,
  issuedAt: timestamp.nullable(),
  sentAt: timestamp.nullable(),
});

export const carrierInvoiceSchema: z.ZodType<CarrierInvoiceView> = z.object({
  ...invoiceBaseFields,
  referenceNumber: z.string().nullable(),
  carrierInvoiceNumber: z.string().nullable(),
  carrierId: z.string(),
  status: z.enum(CarrierInvoiceStatus),
  billingTrigger: z.enum(BillingTrigger),
  expectedTotal: money,
  varianceAmount: money.nullable(),
  receivedAt: timestamp.nullable(),
  approvedAt: timestamp.nullable(),
  approvedById: z.string().nullable(),
  holdReason: z.string().nullable(),
});

// POST /shipment: the shipment and the invoices it made.
export const createdShipmentSchema = z.object({
  shipment: shipmentSchema,
  customerInvoice: customerInvoiceSchema,
  carrierInvoice: carrierInvoiceSchema.nullable(),
});
