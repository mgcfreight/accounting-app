import { PaymentTerms } from "@/lib/enums";
import { apiClient, parseBody } from "./api-client";
import { Charge, ReferenceNumberChanges } from "./invoices";
import {
  createdShipmentSchema,
  envelope,
  paginated,
  shipmentSchema,
} from "./schemas";

// Shipments copied from the TMS (/shipment). Creating one takes the next
// shared invoice number and makes its invoices: the customer invoice as a
// DRAFT, and with a carrier the carrier invoice — EXPECTED (owes 0) until
// the bill arrives, or RECEIVED for PREPAID/COD carriers. Reading needs
// shipments.view and creating shipments.create; the API answers 403
// otherwise. `shipmentId` travels as a query param.

export type ShipmentListParams = {
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
  // Required with a carrier, and only with one.
  carrierCharges?: Charge[];
};

export const listShipments = (
  params: ShipmentListParams,
  signal?: AbortSignal
) =>
  apiClient
    .get("/shipment/all", {
      // The API rejects empty query values, so leave out unset ones.
      params: {
        page: params.page,
        limit: params.limit,
        searchQuery: params.searchQuery || undefined,
        partyId: params.partyId,
      },
      signal,
    })
    .then(
      (res) => parseBody(envelope(paginated(shipmentSchema)), res.data).data
    );

export const getShipment = (shipmentId: string, signal?: AbortSignal) =>
  apiClient
    .get("/shipment", { params: { shipmentId }, signal })
    .then((res) => parseBody(envelope(shipmentSchema), res.data).data);

// Returns the shipment and the invoices it made.
export const createShipment = (shipment: NewShipment) =>
  apiClient
    .post("/shipment", shipment)
    .then((res) => parseBody(envelope(createdShipmentSchema), res.data).data);
