import { z } from "zod";
import { DocumentKind, InvoiceDirection } from "@/lib/enums";
import { apiClient, getFile, parseBody } from "./api-client";
import {
  envelope,
  invoiceDocumentSchema,
  invoiceEmailedSchema,
} from "./schemas";

// An invoice's PDF, its files, and emailing it to the shipper (/invoice).
// The PDF needs the side's export_pdf permission; listing and downloading
// files its view permission; uploading and hiding them its edit permission;
// emailing customer_invoices.send_email.

// What staff may upload; the other kinds the app makes.
export const UPLOADABLE_KINDS = [
  DocumentKind.Pod,
  DocumentKind.Bol,
  DocumentKind.RateConfirmation,
  DocumentKind.CarrierInvoice,
  DocumentKind.Other,
] as const;

export type UploadableKind = (typeof UPLOADABLE_KINDS)[number];

// "Email to shipper". Leave `to` out to send to the shipper's contacts
// receiving invoices, `subject` out for "Invoice <number> from <company>".
export type InvoiceEmail = {
  to?: string[];
  cc?: string[];
  subject?: string;
  message?: string;
  attachPdf?: boolean;
  // The invoice's BOL and POD files.
  attachDocuments?: boolean;
};

const sidePath = (direction: InvoiceDirection) =>
  direction === InvoiceDirection.Receivable
    ? "/invoice/customer"
    : "/invoice/carrier";

// The customer invoice as a PDF made now, or MGC's record of a carrier
// invoice.
export const downloadInvoicePdf = (
  direction: InvoiceDirection,
  invoiceId: string,
  fallbackName: string
) => getFile(`${sidePath(direction)}/pdf`, { invoiceId }, fallbackName);

// An issued customer invoice only. 409 if email is off; 502 if it failed.
export const emailCustomerInvoice = (invoiceId: string, email: InvoiceEmail) =>
  apiClient
    .post("/invoice/customer/email", email, { params: { invoiceId } })
    .then((res) => parseBody(envelope(invoiceEmailedSchema), res.data).data);

// Oldest first; hidden files are left out.
export const listInvoiceDocuments = (
  direction: InvoiceDirection,
  invoiceId: string,
  signal?: AbortSignal
) =>
  apiClient
    .get(`${sidePath(direction)}/documents`, { params: { invoiceId }, signal })
    .then(
      (res) =>
        parseBody(envelope(z.array(invoiceDocumentSchema)), res.data).data
    );

// A PDF, PNG or JPEG, up to 10 MB; the API checks the content, not just
// the name.
export const uploadInvoiceDocument = (
  direction: InvoiceDirection,
  invoiceId: string,
  kind: UploadableKind,
  file: File
) => {
  const form = new FormData();
  form.append("kind", kind);
  form.append("file", file);
  return apiClient
    .post(`${sidePath(direction)}/document`, form, { params: { invoiceId } })
    .then((res) => parseBody(envelope(invoiceDocumentSchema), res.data).data);
};

export const downloadInvoiceDocument = (
  direction: InvoiceDirection,
  invoiceId: string,
  documentId: string,
  fallbackName: string
) =>
  getFile(
    `${sidePath(direction)}/document`,
    { invoiceId, documentId },
    fallbackName
  );

// Hides an uploaded file; it is kept on record.
export const removeInvoiceDocument = (
  direction: InvoiceDirection,
  invoiceId: string,
  documentId: string
) =>
  apiClient
    .put(`${sidePath(direction)}/document/remove`, undefined, {
      params: { invoiceId, documentId },
    })
    .then((res) => parseBody(z.object({ message: z.string() }), res.data));
