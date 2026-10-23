import {
  AdjustmentMode,
  BillingTrigger,
  Currency,
  PartyType,
  PaymentTerms,
  TaxBasis,
  TaxTreatment,
} from "@/lib/enums";
import { AgreementView, PartyView } from "@/lib/interfaces";
import { apiClient } from "./api-client";
import {
  isCount,
  isDateOnly,
  isNonEmptyString,
  isOneOf,
  isString,
  isTimestamp,
  orNull,
  parseList,
  parseOptional,
  parsePage,
  parseShape,
  Parser,
  unwrap,
} from "./parse";

// Customers (SHIPPER) and carriers (CARRIER), and their agreed terms (the
// API's /party routes). Anyone signed in reads; Admins and Accountants
// create. The party is picked by `partyId` in the query string.

export type PartyListQuery = {
  page: number;
  // At most 100.
  limit: number;
  // Name, legal name or MGC id.
  searchQuery?: string;
  type?: PartyType;
  isActive?: boolean;
};

// Typed in by staff until the MGC sync brings parties. A Canadian party
// needs its province: the billing address picks the tax rate.
export type NewParty = {
  type: PartyType;
  mgcId: string;
  name: string;
  legalName?: string;
  gstHstNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  // ISO code, "CA".
  country: string;
  defaultCurrency: Currency;
};

// Terms from a date. The party's current open-ended agreement ends the day
// before. A carrier agreement needs a billing trigger; a customer's can't
// have one. The currency must match the party's earlier agreements.
export type NewAgreement = {
  partyId: string;
  paymentTerms?: PaymentTerms;
  currency: Currency;
  taxTreatment?: TaxTreatment;
  taxBasis?: TaxBasis;
  billingTrigger?: BillingTrigger;
  // 0-60.
  noticeDaysBefore?: number;
  alertDaysBefore?: number;
  autoSendInvoices?: boolean;
  // "YYYY-MM-DD".
  effectiveFrom: string;
  notes?: string;
};

const nullableString = orNull(isString);
const nullableCount = orNull(isCount);
const isBoolean = (value: unknown) => typeof value === "boolean";

const parseAgreement = parseShape<AgreementView>({
  id: isNonEmptyString,
  partyId: isNonEmptyString,
  paymentTerms: isOneOf(PaymentTerms),
  currency: isOneOf(Currency),
  taxTreatment: isOneOf(TaxTreatment),
  taxBasis: isOneOf(TaxBasis),
  billingTrigger: orNull(isOneOf(BillingTrigger)),
  noticeDaysBefore: nullableCount,
  alertDaysBefore: nullableCount,
  defaultAdjustmentMode: isOneOf(AdjustmentMode),
  autoSendInvoices: isBoolean,
  billingNoticeEnabled: isBoolean,
  remindersEnabled: isBoolean,
  weeklyStatementEnabled: isBoolean,
  effectiveFrom: isDateOnly,
  effectiveTo: orNull(isDateOnly),
  notes: nullableString,
  createdAt: isTimestamp,
});

const parsePartyFields = parseShape<Omit<PartyView, "agreements">>({
  id: isNonEmptyString,
  type: isOneOf(PartyType),
  mgcId: isNonEmptyString,
  name: isNonEmptyString,
  legalName: nullableString,
  gstHstNumber: nullableString,
  addressLine1: nullableString,
  addressLine2: nullableString,
  city: nullableString,
  province: nullableString,
  postalCode: nullableString,
  country: isNonEmptyString,
  defaultCurrency: isOneOf(Currency),
  isActive: isBoolean,
  createdAt: isTimestamp,
  updatedAt: isTimestamp,
});

export const parseParty: Parser<PartyView> = (value) => {
  const party = parsePartyFields(value);
  if (!party) return null;
  const agreements = parseOptional(
    parseList(parseAgreement),
    (value as { agreements?: unknown }).agreements
  );
  if (agreements === null) return null;
  return agreements ? { ...party, agreements } : party;
};

export const getParties = async (query: PartyListQuery, signal?: AbortSignal) =>
  unwrap(
    await apiClient.get("/party/all", { params: query, signal }),
    parsePage(parseParty)
  );

// With its agreements, newest first.
export const getParty = async (partyId: string, signal?: AbortSignal) =>
  unwrap(
    await apiClient.get("/party", { params: { partyId }, signal }),
    parseParty
  );

export const createParty = async (body: NewParty) =>
  unwrap(await apiClient.post("/party", body), parseParty);

export const createAgreement = async (body: NewAgreement) =>
  unwrap(await apiClient.post("/party/agreement", body), parseAgreement);
