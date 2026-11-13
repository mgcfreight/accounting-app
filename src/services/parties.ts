import { z } from "zod";
import {
  BillingTrigger,
  Currency,
  PartyType,
  PaymentTerms,
  TaxBasis,
  TaxTreatment,
} from "@/lib/enums";
import { PartyAutomation } from "@/lib/interfaces";
import { apiClient, parseBody } from "./api-client";
import {
  agreementSchema,
  contactSchema,
  envelope,
  paginated,
  partyAutomationViewSchema,
  partySchema,
} from "./schemas";

// Customers (SHIPPER) and carriers (CARRIER), their agreed terms and their
// contacts (/party). Reading needs parties.view, adding a party
// parties.create, and new terms or contacts parties.edit; the API answers
// 403 otherwise. `partyId` and `contactId` travel as query params.

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

// A person at the party. The email is unique per party and stored
// lower-case. Statements go to the first active contact with
// receivesStatements; without one, emailing a statement is refused.
export type NewContact = {
  partyId: string;
  name: string;
  email: string;
  phone?: string;
  receivesInvoices?: boolean;
  receivesReminders?: boolean;
  receivesStatements?: boolean;
};

// Send only what changes. `phone: ""` clears it; `isActive: false` retires
// the contact.
export type ContactChanges = Partial<Omit<NewContact, "partyId">> & {
  isActive?: boolean;
};

// Active ones first, then by name. Not paged.
export const listContacts = (partyId: string, signal?: AbortSignal) =>
  apiClient
    .get("/party/contacts", { params: { partyId }, signal })
    .then((res) => parseBody(envelope(z.array(contactSchema)), res.data).data);

export const createContact = (contact: NewContact) =>
  apiClient
    .post("/party/contact", contact)
    .then((res) => parseBody(envelope(contactSchema), res.data).data);

// The party's Notifications & Automation settings; `automation` is null until
// saved. Saving (parties.edit) replaces them whole. Stored only: nothing is
// sent from them yet.
export const getAutomation = (partyId: string, signal?: AbortSignal) =>
  apiClient
    .get("/party/automation", { params: { partyId }, signal })
    .then((res) => parseBody(envelope(partyAutomationViewSchema), res.data).data);

// `expectedUpdatedAt`: the updatedAt the save was made from (null when none
// was saved). Newer settings on the server answer 409: someone else saved
// first, and the card reloads (accounting#77).
export const saveAutomation = (
  partyId: string,
  automation: PartyAutomation,
  expectedUpdatedAt: string | null
) =>
  apiClient
    .put("/party/automation", { ...automation, expectedUpdatedAt }, { params: { partyId } })
    .then((res) => parseBody(envelope(partyAutomationViewSchema), res.data).data);

export const updateContact = (contactId: string, changes: ContactChanges) =>
  apiClient
    .put("/party/contact", changes, { params: { contactId } })
    .then((res) => parseBody(envelope(contactSchema), res.data).data);
