import { Currency, PaymentTerms, ShipmentSource } from "@/lib/enums";
import {
  CarrierInvoiceView,
  CustomerInvoiceView,
  ShipmentView,
} from "@/lib/interfaces";
import { apiClient } from "./api-client";
import {
  Charge,
  parseCarrierInvoice,
  parseCustomerInvoice,
  ReferenceNumberChanges,
} from "./invoices";
import {
  isDateOnly,
  isMoney,
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

// Shipments copied from the TMS (the API's /shipment routes). Creating one
// takes the next shared invoice number and makes its invoices: the customer
// invoice as a DRAFT, and with a carrier the carrier invoice — EXPECTED
// (owes 0) until the bill arrives, or RECEIVED for PREPAID/COD carriers.
// Anyone signed in reads; Admins and Accountants create. No screen uses
// these yet.

export type ShipmentListQuery = {
  page: number;
  // At most 100.
  limit: number;
  // Exact load number, MGC id or any reference number.
  searchQuery?: string;
  partyId?: string;
};

// Typed in by staff until the MGC sync brings shipments. Currencies come
// from each party's agreement. Countries are ISO codes; a Canadian address
// needs its province. Dates are "YYYY-MM-DD"; `mgcCreatedAt` is an ISO
// date-time whose Toronto date becomes the invoice date.
export type NewShipment = ReferenceNumberChanges & {
  mgcShipmentId: string;
  loadNumber: string;
  shipperPartyId: string;
  carrierPartyId?: string;
  tmsStatus: string;
  tmsPaymentTerms: PaymentTerms;
  tmsCustomerInvoiceCode?: string;
  tmsCarrierInvoiceCode?: string;
  originCity?: string;
  originProvince?: string;
  originCountry?: string;
  destinationCity?: string;
  destinationProvince?: string;
  destinationCountry?: string;
  pickupDate?: string;
  deliveryDate?: string;
  mgcCreatedAt: string;
  // At least one.
  customerCharges: Charge[];
  // Required with a carrier.
  carrierCharges?: Charge[];
};

export type CreatedShipment = {
  shipment: ShipmentView;
  customerInvoice: CustomerInvoiceView;
  carrierInvoice: CarrierInvoiceView | null;
};

const nullableString = orNull(isString);

export const parseShipment = parseShape<ShipmentView>({
  id: isNonEmptyString,
  mgcShipmentId: isNonEmptyString,
  loadNumber: isNonEmptyString,
  bolNumber: nullableString,
  pickupNumber: nullableString,
  poNumber: nullableString,
  soNumber: nullableString,
  proNumber: nullableString,
  quoteNumber: nullableString,
  billNumber: nullableString,
  source: isOneOf(ShipmentSource),
  shipperPartyId: isNonEmptyString,
  carrierPartyId: nullableString,
  tmsStatus: isString,
  tmsPaymentTerms: isOneOf(PaymentTerms),
  invoiceSequence: nullableString,
  tmsCustomerInvoiceCode: nullableString,
  tmsCarrierInvoiceCode: nullableString,
  originCity: nullableString,
  originProvince: nullableString,
  originCountry: nullableString,
  destinationCity: nullableString,
  destinationProvince: nullableString,
  destinationCountry: nullableString,
  pickupDate: orNull(isDateOnly),
  deliveryDate: orNull(isDateOnly),
  sellCurrency: isOneOf(Currency),
  sellTotal: isMoney,
  buyCurrency: orNull(isOneOf(Currency)),
  buyTotal: orNull(isMoney),
  mgcCreatedAt: isTimestamp,
  createdAt: isTimestamp,
});

const parseCreated: Parser<CreatedShipment> = (value) => {
  if (!isRecord(value)) return null;
  const shipment = parseShipment(value.shipment);
  const customerInvoice = parseCustomerInvoice(value.customerInvoice);
  const carrierInvoice =
    value.carrierInvoice === null
      ? null
      : parseCarrierInvoice(value.carrierInvoice);
  if (
    !shipment ||
    !customerInvoice ||
    (value.carrierInvoice !== null && !carrierInvoice)
  ) {
    return null;
  }
  return { shipment, customerInvoice, carrierInvoice };
};

export const getShipments = async (
  query: ShipmentListQuery,
  signal?: AbortSignal
) =>
  unwrap(
    await apiClient.get("/shipment/all", { params: query, signal }),
    parsePage(parseShipment)
  );

export const getShipment = async (shipmentId: string, signal?: AbortSignal) =>
  unwrap(
    await apiClient.get("/shipment", { params: { shipmentId }, signal }),
    parseShipment
  );

// Returns the shipment and the invoices it made.
export const createShipment = async (body: NewShipment) =>
  unwrap(await apiClient.post("/shipment", body), parseCreated);
