import { z } from "zod";
import { InvoiceDirection } from "@/lib/enums";
import { apiClient, parseBody } from "./api-client";
import { envelope, paginated, reviewItemSchema } from "./schemas";

// Needs Review's MGC changes (/invoice/review): live invoices the TMS
// changed or cancelled after they were invoiced. The sync flags them; a
// draft or expected bill nobody edited also takes the TMS's new figure, the
// rest keep their amounts. Each side is listed only for a role with its invoice
// view permission; resolving needs the side's invoice edit permission.

export type ReviewListParams = {
  page: number;
  // At most 100.
  limit: number;
  // Omitted: both, as far as the role may see.
  direction?: InvoiceDirection;
};

// Newest change first.
export const listReviewItems = (params: ReviewListParams, signal?: AbortSignal) =>
  apiClient
    .get("/invoice/review", {
      params: { page: params.page, limit: params.limit, direction: params.direction },
      signal,
    })
    .then((res) => parseBody(envelope(paginated(reviewItemSchema)), res.data).data);

// Clears the invoice's TMS flag. Act on the invoice first (revise, credit or
// debit note, void); the note says what was done. 409 when someone changed
// the invoice since `version` was read, or nothing is left to resolve.
export const resolveReviewItem = (
  item: { direction: InvoiceDirection; invoiceId: string; version: number },
  note: string
) =>
  apiClient
    .put(
      "/invoice/review/resolve",
      { version: item.version, note },
      { params: { direction: item.direction, invoiceId: item.invoiceId } }
    )
    .then(
      (res) =>
        parseBody(
          envelope(z.object({ invoiceId: z.string(), version: z.number().int() })),
          res.data
        ).data
    );
