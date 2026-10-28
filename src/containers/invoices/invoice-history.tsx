import { useQuery } from "@tanstack/react-query";
import { BaseCardWrapper, StatusChip } from "@/components/common";
import { useCurrentUser } from "@/components/providers/user-provider";
import { AuditEvent } from "@/lib/interfaces";
import { formatDateTime, fullName } from "@/lib/utils";
import { listAuditEvents } from "@/services";
import { InvoiceView, isCustomerInvoice } from "./invoice-view";

// What each invoice action in the audit log means, in words.
const ACTION_LABELS: Record<string, string> = {
  "customer_invoice.updated": "Details edited",
  "customer_invoice.issued": "Issued",
  "customer_invoice.revised": "Issued as a new version",
  "carrier_invoice.updated": "Details edited",
  "carrier_invoice.received": "Carrier bill entered",
  "carrier_invoice.approved": "Approved for payment",
  "carrier_invoice.revised": "Changed bill entered as a new version",
};

const actionLabel = (action: string) =>
  ACTION_LABELS[action] ??
  (action.split(".").slice(1).join(".").replace(/_/g, " ") || action);

// The fields an event names: the keys of its details, e.g. "notes, poNumber".
const changedKeys = (event: AuditEvent) =>
  event.details ? Object.keys(event.details).join(", ") : "";

// Who changed this invoice, and when, from the audit log (requirement:
// audit trail for all invoice modifications). Only this version's events:
// a new version's "revised" event is on the new one.
export default function InvoiceHistory({ invoice }: { invoice: InvoiceView }) {
  const me = useCurrentUser();
  const params = {
    page: 1,
    limit: 20,
    targetType: isCustomerInvoice(invoice) ? "customer_invoice" : "carrier_invoice",
    targetId: invoice.id,
  };
  const events = useQuery({
    queryKey: ["audit", params],
    queryFn: ({ signal }) => listAuditEvents(params, signal),
  });

  return (
    <BaseCardWrapper heading="History">
      {events.isError ? (
        <p className="text-sm text-base-danger">
          Couldn&apos;t load this invoice&apos;s history.{" "}
          <button
            type="button"
            className="underline"
            onClick={() => void events.refetch()}
          >
            Try again
          </button>
        </p>
      ) : events.isPending ? (
        <p className="text-sm text-content-5">Loading…</p>
      ) : events.data.items.length === 0 ? (
        <p className="text-sm text-content-5">No changes recorded yet.</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {events.data.items.map((event) => (
            <li
              key={event.id}
              className="flex flex-wrap justify-between items-start gap-3 text-sm"
            >
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusChip text={actionLabel(event.action)} tone="neutral" />
                  <span>{event.actor ? fullName(event.actor) : "System"}</span>
                </div>
                {changedKeys(event) && (
                  <span className="text-xs text-content-5">
                    {/* Rendered as text by React, so keys can't inject markup. */}
                    {changedKeys(event)}
                  </span>
                )}
              </div>
              <span className="text-xs text-content-5 whitespace-nowrap">
                {formatDateTime(event.createdAt)}
              </span>
            </li>
          ))}
        </ol>
      )}
      {!me.isAdmin && (
        <p className="text-xs text-content-5 pt-3">
          Showing only the changes you made. An Admin sees everyone&apos;s.
        </p>
      )}
      {events.data && events.data.meta.totalItems > events.data.items.length && (
        <p className="text-xs text-content-5 pt-1">
          The latest {events.data.items.length} of {events.data.meta.totalItems}{" "}
          changes. The Audit Report has the rest.
        </p>
      )}
    </BaseCardWrapper>
  );
}
