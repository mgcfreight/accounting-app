import {
  BillingTrigger,
  Currency,
  PartyType,
  PaymentTerms,
  TaxBasis,
  TaxTreatment,
} from "@/lib/enums";
import { apiClient, parseBody } from "./api-client";
import { agreementSchema, envelope, paginated, partySchema } from "./schemas";

// Customers (SHIPPER) and carriers (CARRIER), and their agreed terms (/party).
// Reading needs parties.view, adding a party parties.create, and new terms
// parties.edit; the API answers 403 otherwise. `partyId` travels as a query
// param.

export type PartyListParams = {
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

export const listParties = (params: PartyListParams, signal?: AbortSignal) =>
  apiClient
    .get("/party/all", {
      // The API rejects empty query values, so leave out unset ones.
      params: {
        page: params.page,
        limit: params.limit,
        searchQuery: params.searchQuery || undefined,
        type: params.type,
        isActive:
          params.isActive === undefined ? undefined : String(params.isActive),
      },
      signal,
    })
    .then((res) => parseBody(envelope(paginated(partySchema)), res.data).data);

// With its agreements, newest first.
export const getParty = (partyId: string, signal?: AbortSignal) =>
  apiClient
    .get("/party", { params: { partyId }, signal })
    .then((res) => parseBody(envelope(partySchema), res.data).data);

export const createParty = (party: NewParty) =>
  apiClient
    .post("/party", party)
    .then((res) => parseBody(envelope(partySchema), res.data).data);

export const createAgreement = (agreement: NewAgreement) =>
  apiClient
    .post("/party/agreement", agreement)
    .then((res) => parseBody(envelope(agreementSchema), res.data).data);
