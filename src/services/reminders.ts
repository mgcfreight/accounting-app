import { InvoiceDirection, ReminderStatus } from "@/lib/enums";
import { apiClient, parseBody } from "./api-client";
import {
  envelope,
  paginated,
  reminderCountsSchema,
  reminderSchema,
} from "./schemas";

// Payment reminders (/reminder): emails to shippers before (and after) a due
// date, and alerts to the accounts team before a carrier bill falls due.
// Each side is listed only for a role with its invoice view permission; one
// that may see neither gets 403. Sending a shipper's reminder needs
// customer_invoices.send_email, skipping it customer_invoices.edit; both
// need carrier_invoices.edit on the carrier side.

export type ReminderListParams = {
  page: number;
  // At most 100.
  limit: number;
  status?: ReminderStatus;
  // Omitted: both, as far as the role may see.
  direction?: InvoiceDirection;
  // Part of the invoice number or the party's name.
  searchQuery?: string;
};

const sidePath = (direction: InvoiceDirection) =>
  direction === InvoiceDirection.Receivable
    ? "/reminder/customer"
    : "/reminder/carrier";

// Latest remind-on date first.
export const listReminders = (
  params: ReminderListParams,
  signal?: AbortSignal
) =>
  apiClient
    .get("/reminder/all", {
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
      (res) => parseBody(envelope(paginated(reminderSchema)), res.data).data
    );

export const getReminderCounts = (signal?: AbortSignal) =>
  apiClient
    .get("/reminder/counts", { signal })
    .then((res) => parseBody(envelope(reminderCountsSchema), res.data).data);

// Sends it now. Checked first: a paid, voided or replaced invoice, or
// reminders off, skip it instead (status SKIPPED). 409 if it is no longer
// scheduled or email is off; 502 if the email failed.
export const sendReminder = (direction: InvoiceDirection, reminderId: string) =>
  apiClient
    .post(`${sidePath(direction)}/send`, undefined, { params: { reminderId } })
    .then((res) => parseBody(envelope(reminderSchema), res.data).data);

export const skipReminder = (
  direction: InvoiceDirection,
  reminderId: string,
  reason: string
) =>
  apiClient
    .put(`${sidePath(direction)}/skip`, { reason }, { params: { reminderId } })
    .then((res) => parseBody(envelope(reminderSchema), res.data).data);
