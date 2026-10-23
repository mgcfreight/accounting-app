import { CompanySettings, NoticeSettings } from "@/lib/interfaces";
import { apiClient, parseBody } from "./api-client";
import {
  accountingPeriodSchema,
  chargeTypeSchema,
  companySettingsSchema,
  envelope,
  noticeSettingsSchema,
  paginated,
  taxRateSchema,
} from "./schemas";

// Settings (/settings). Reading is open to every role; saving is Admin only
// on the API, and every save is written to the audit log.

type Editable<T> = Omit<T, "updatedAt" | "updatedBy">;
export type CompanySettingsInput = Editable<CompanySettings> & {
  legalName: string;
};
export type NoticeSettingsInput = Editable<NoticeSettings>;

export const getCompanySettings = (signal?: AbortSignal) =>
  apiClient
    .get("/settings/company", { signal })
    .then((res) => parseBody(envelope(companySettingsSchema), res.data).data);

export const saveCompanySettings = (settings: CompanySettingsInput) =>
  apiClient
    .put("/settings/company", settings)
    .then((res) => parseBody(envelope(companySettingsSchema), res.data).data);

export const getNoticeSettings = (signal?: AbortSignal) =>
  apiClient
    .get("/settings/notices", { signal })
    .then((res) => parseBody(envelope(noticeSettingsSchema), res.data).data);

export const saveNoticeSettings = (settings: NoticeSettingsInput) =>
  apiClient
    .put("/settings/notices", settings)
    .then((res) => parseBody(envelope(noticeSettingsSchema), res.data).data);

// Months with no row are open; the list holds months ever closed.
export const listAccountingPeriods = (
  params: { page: number; limit: number },
  signal?: AbortSignal
) =>
  apiClient
    .get("/settings/accounting-periods", { params, signal })
    .then(
      (res) =>
        parseBody(envelope(paginated(accountingPeriodSchema)), res.data).data
    );

// `period` is "YYYY-MM". Only a month that has ended can be closed.
export const closeAccountingPeriod = (period: string) =>
  apiClient
    .post("/settings/accounting-periods/close", { period })
    .then((res) => parseBody(envelope(accountingPeriodSchema), res.data).data);

export const reopenAccountingPeriod = (period: string) =>
  apiClient
    .post("/settings/accounting-periods/reopen", { period })
    .then((res) => parseBody(envelope(accountingPeriodSchema), res.data).data);

export type TaxRateListParams = {
  page: number;
  limit: number;
  jurisdiction?: string;
  code?: string;
  // Only rates that apply today or later.
  current?: boolean;
};

export const listTaxRates = (params: TaxRateListParams, signal?: AbortSignal) =>
  apiClient
    .get("/settings/tax-rates", {
      params: {
        ...params,
        jurisdiction: params.jurisdiction || undefined,
        code: params.code || undefined,
        current: params.current ? "true" : undefined,
      },
      signal,
    })
    .then(
      (res) => parseBody(envelope(paginated(taxRateSchema)), res.data).data
    );

// `ratePercent` stays text ("13.000"). The API ends the code's current rate
// the day before `effectiveFrom`, in the same transaction.
export type NewTaxRate = {
  code: string;
  jurisdiction: string;
  name: string;
  ratePercent: string;
  effectiveFrom: string;
  isRecoverable: boolean;
};

export const createTaxRate = (rate: NewTaxRate) =>
  apiClient
    .post("/settings/tax-rates", rate)
    .then((res) => parseBody(envelope(taxRateSchema), res.data).data);

export const listChargeTypes = (
  params: { page: number; limit: number; isActive?: boolean },
  signal?: AbortSignal
) =>
  apiClient
    .get("/settings/charge-types", {
      params: {
        page: params.page,
        limit: params.limit,
        isActive:
          params.isActive === undefined ? undefined : String(params.isActive),
      },
      signal,
    })
    .then(
      (res) => parseBody(envelope(paginated(chargeTypeSchema)), res.data).data
    );

export type NewChargeType = {
  code: string;
  name: string;
  mgcCode?: string;
  defaultTaxable: boolean;
};

export const createChargeType = (chargeType: NewChargeType) =>
  apiClient
    .post("/settings/charge-types", chargeType)
    .then((res) => parseBody(envelope(chargeTypeSchema), res.data).data);

export type ChargeTypeChanges = {
  name?: string;
  // null clears the TMS mapping.
  mgcCode?: string | null;
  defaultTaxable?: boolean;
  isActive?: boolean;
};

export const updateChargeType = (code: string, changes: ChargeTypeChanges) =>
  apiClient
    .put("/settings/charge-types", changes, { params: { code } })
    .then((res) => parseBody(envelope(chargeTypeSchema), res.data).data);
