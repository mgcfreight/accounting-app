import { DisputeOutcome, DisputeStatus, InvoiceDirection } from "@/lib/enums";
import { apiClient, parseBody } from "./api-client";
import { disputeSchema, envelope, paginated } from "./schemas";

// Disputes (/dispute): a shipper invoice or carrier bill the party
// disputes. While open, its amount sits in the aging's Disputed column and
// reminders for the invoice pause. Each side is listed only for a role with
// its invoice view permission; opening and resolving need the side's
// invoice edit permission, and a write-off customer_invoices.write_off too.

export type DisputeListParams = {
  page: number;
  // At most 100.
  limit: number;
  status?: DisputeStatus;
  // Omitted: both, as far as the role may see.
  direction?: InvoiceDirection;
  // Part of the invoice number or the party's name.
  searchQuery?: string;
};

export type OpenDispute = {
  invoiceId: string;
  // Tax included, above zero and up to the balance.
  amount: string;
  reason: string;
};

export type ResolveDispute = {
  outcome: DisputeOutcome;
  // What was agreed, and with whom.
  note: string;
  // Shipper disputes: the issued credit note that settled it.
  creditNoteId?: string;
};

const sidePath = (direction: InvoiceDirection) =>
  direction === InvoiceDirection.Receivable
    ? "/dispute/customer"
    : "/dispute/carrier";

// Newest first.
export const listDisputes = (params: DisputeListParams, signal?: AbortSignal) =>
  apiClient
    .get("/dispute/all", {
      params: {
        page: params.page,
        limit: params.limit,
        status: params.status,
        direction: params.direction,
        searchQuery: params.searchQuery || undefined,
      },
      signal,
    })
    .then(
      (res) => parseBody(envelope(paginated(disputeSchema)), res.data).data
    );

// "Flag as disputed". 409 if the invoice already has an open dispute.
export const openDispute = (direction: InvoiceDirection, body: OpenDispute) =>
  apiClient
    .post(sidePath(direction), body)
    .then((res) => parseBody(envelope(disputeSchema), res.data).data);

// A WRITE_OFF writes off as much of the disputed amount as the invoice
// still owes. 409 if the dispute is no longer open.
export const resolveDispute = (
  direction: InvoiceDirection,
  disputeId: string,
  body: ResolveDispute
) =>
  apiClient
    .put(`${sidePath(direction)}/resolve`, body, { params: { disputeId } })
    .then((res) => parseBody(envelope(disputeSchema), res.data).data);
