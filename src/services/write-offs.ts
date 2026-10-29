import { apiClient, parseBody } from "./api-client";
import { envelope, paginated, writeOffSchema } from "./schemas";

// Write-offs (/invoice/customer): a shipper invoice's balance, or part of
// it, written off as bad debt; the GST/HST share is claimed back as
// bad-debt relief. Writing off and reversing need
// customer_invoices.write_off; listing customer_invoices.view.

export type WriteOffParams = {
  page: number;
  // At most 100.
  limit: number;
  customerId?: string;
  // Written off from / up to this day, "YYYY-MM-DD".
  from?: string;
  to?: string;
};

// Left out, `amount` is the whole balance. 409 while the invoice is
// disputed or if someone changed it since `version`.
export const writeOffInvoice = (
  invoiceId: string,
  body: { version: number; reason: string; amount?: string }
) =>
  apiClient
    .post("/invoice/customer/write-off", body, { params: { invoiceId } })
    .then((res) => parseBody(envelope(writeOffSchema), res.data).data);

// The invoice owes the amount again.
export const reverseWriteOff = (writeOffId: string, reason: string) =>
  apiClient
    .put(
      "/invoice/customer/write-off/reverse",
      { reason },
      { params: { writeOffId } }
    )
    .then((res) => parseBody(envelope(writeOffSchema), res.data).data);

// Newest first, reversed ones included.
export const listWriteOffs = (params: WriteOffParams, signal?: AbortSignal) =>
  apiClient
    .get("/invoice/customer/write-offs", { params, signal })
    .then(
      (res) => parseBody(envelope(paginated(writeOffSchema)), res.data).data
    );
