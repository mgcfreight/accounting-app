import { TmsDocumentKind } from "./enums";
import { TmsDocuments } from "./interfaces";

// The TMS keeps shipment documents and invoice PDFs in its own file storage
// and links them as `${MEDIA_URL}/${key}`; Accounts links the same files.
// Only an http(s) base is used; unset, documents are listed without links.
const configuredMediaUrl = (import.meta.env.VITE_MGC_MEDIA_URL ?? "").replace(
  /\/+$/,
  ""
);
const MEDIA_URL = /^https?:\/\/[^/]+/.test(configuredMediaUrl)
  ? configuredMediaUrl
  : "";

export const documentLabels: Record<TmsDocumentKind, string> = {
  [TmsDocumentKind.Bol]: "Bill of lading (BOL)",
  [TmsDocumentKind.ShippingLabels]: "Shipping labels",
  [TmsDocumentKind.CustomsInvoice]: "Customs invoice",
  [TmsDocumentKind.Invoice]: "Shipment invoice",
  [TmsDocumentKind.CustomerInvoicePdf]: "TMS shipper invoice (PDF)",
  [TmsDocumentKind.CarrierInvoicePdf]: "TMS carrier invoice (PDF)",
};

export interface DocumentLink {
  kind: TmsDocumentKind;
  label: string;
  fileName: string;
  // Null when no storage URL is configured.
  href: string | null;
}

// The documents of `kinds` the shipment has, in that order. Keys were
// checked as plain file keys on arrival (services/schemas.ts); each path
// segment is still encoded here.
export function documentLinks(
  documents: TmsDocuments,
  kinds: readonly TmsDocumentKind[] = Object.values(TmsDocumentKind)
): DocumentLink[] {
  return kinds.flatMap((kind) => {
    const key = documents[kind];
    if (!key) return [];
    const segments = key.split("/");
    return [
      {
        kind,
        label: documentLabels[kind],
        fileName: segments[segments.length - 1],
        href: MEDIA_URL
          ? `${MEDIA_URL}/${segments.map(encodeURIComponent).join("/")}`
          : null,
      },
    ];
  });
}
