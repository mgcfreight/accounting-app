import { useQuery } from "@tanstack/react-query";
import { FocusEvent, Fragment, useEffect, useState } from "react";
import { FormModal, Money } from "@/components/common";
import { useCan } from "@/components/providers/user-provider";
import { Permission } from "@/lib/enums";
import { TmsOverdueShipper } from "@/lib/interfaces";
import { getOverdueShippers } from "@/services";
import RecordPaymentModal from "./record-payment-modal";

// How often the overdue list is read again while a page stays open.
const REFRESH_MS = 5 * 60_000;

// A shipper owing in two currencies has a row for each.
const keyOf = (shipper: TmsOverdueShipper) => `${shipper.partyId}-${shipper.currency}`;

// How long each overdue shipper stays in the bar before the next.
export const TICKER_MS = 5000;

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

const barButton =
  "rounded-md bg-base-primary-900 text-white text-xs font-semibold px-3 py-1.5 hover:bg-base-primary-600 focus-visible:outline-2 focus-visible:outline-base-primary-900";
const iconButton =
  "rounded-md px-2 py-1 leading-none hover:bg-black/10 focus-visible:outline-2 focus-visible:outline-base-primary-900";

// The strip above the header, on every signed-in page, while any shipper has
// an overdue invoice (GET /account/overdue). It shows one shipper at a time
// and moves to the next every TICKER_MS, most overdue first.
//
// It holds still while the pointer or keyboard focus is on it (so Clear
// Payment can't change shipper under a click), while a modal is open, and
// after Pause. While it rotates, screen readers aren't told of each change;
// stepping with the arrows announces the new one.
//
// Only for those who may see shipper invoices (customer_invoices.view);
// Clear Payment also needs customer_payments.create, and records a real
// payment. Dismissing hides it, and stops reading the list, until the next
// page load. While the list loads, or if the last read failed, the bar stays
// hidden rather than show older amounts: it is a prompt, and the dashboard
// shows the same figures. It sits under ["accounts"], so every change that
// moves a balance refreshes it (refreshMoneyViews).
export default function TmsOverdueBar() {
  const { can } = useCan();
  const canView = can(Permission.CustomerInvoicesView);
  const canRecord = canView && can(Permission.CustomerPaymentsCreate);
  const [dismissed, setDismissed] = useState(false);
  const summary = useQuery({
    queryKey: ["accounts", "overdue"],
    queryFn: ({ signal }) => getOverdueShippers(signal),
    enabled: canView && !dismissed,
    refetchInterval: REFRESH_MS,
  });
  const [listing, setListing] = useState(false);
  const [recording, setRecording] = useState<TmsOverdueShipper | null>(null);
  // The row shown, by key: a refreshed list that is re-sorted or shorter
  // can't put another shipper under the pointer.
  const [shownKey, setShownKey] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  // Rows and totals are both shown exactly as the summary sends them. Filtering
  // rows here would leave the sender's totals counting shippers the list no
  // longer shows, and re-summing them would be arithmetic on money. Which
  // shippers count as overdue is the sender's call.
  const overdue = summary.isError ? undefined : summary.data;
  const shippers = overdue?.shippers ?? [];
  const count = shippers.length;
  // A row that left the list falls back to the first.
  const position = Math.max(
    0,
    shippers.findIndex((shipper) => keyOf(shipper) === shownKey)
  );
  const rotating =
    count > 1 && !dismissed && !paused && !hovered && !focused && !listing && !recording;

  const step = (by: number) =>
    setShownKey(keyOf(shippers[(position + by + count) % count]));

  const nextKey = count > 0 ? keyOf(shippers[(position + 1) % count]) : null;
  useEffect(() => {
    if (!rotating || nextKey === null) return;
    const timer = setTimeout(() => setShownKey(nextKey), TICKER_MS);
    return () => clearTimeout(timer);
  }, [rotating, nextKey]);

  if (!canView || dismissed || !overdue || count === 0) return null;
  const current = shippers[position];
  const record = (shipper: TmsOverdueShipper) => {
    setListing(false);
    setRecording(shipper);
  };
  const leave = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
  };

  return (
    <>
      <section
        aria-label="Overdue payments"
        className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 shrink-0 bg-base-warning text-base-primary-900 text-sm px-4 py-2 overflow-hidden"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={leave}
      >
        <p className="text-center" aria-live={rotating ? "off" : "polite"} aria-atomic>
          <strong>
            Payment overdue{count > 1 && ` · ${position + 1} of ${count}`}:
          </strong>{" "}
          {/* Keyed by shipper, so each one plays the slide-in. */}
          <span
            key={keyOf(current)}
            className="inline-block animate-ticker-in motion-reduce:animate-none"
          >
            {current.partyName} owes{" "}
            <strong>
              <Money amount={current.amount} currency={current.currency} />
            </strong>{" "}
            on {plural(current.invoiceCount, "invoice")}, the oldest{" "}
            {plural(current.oldestOverdueDays, "day")} past due.
          </span>{" "}
          Clear the overdue payment.
        </p>
        <div className="flex items-center gap-1">
          {canRecord && (
            <button
              type="button"
              className={barButton}
              aria-label={`Clear payment for ${current.partyName}`}
              onClick={() => record(current)}
            >
              Clear Payment
            </button>
          )}
          {count > 1 && (
            <>
              <button type="button" className={barButton} onClick={() => setListing(true)}>
                View All
              </button>
              <button
                type="button"
                aria-label="Previous overdue payment"
                className={`${iconButton} text-lg`}
                onClick={() => step(-1)}
              >
                <span aria-hidden>‹</span>
              </button>
              <button
                type="button"
                aria-label="Next overdue payment"
                className={`${iconButton} text-lg`}
                onClick={() => step(1)}
              >
                <span aria-hidden>›</span>
              </button>
              <button
                type="button"
                aria-label={paused ? "Play" : "Pause"}
                aria-pressed={paused}
                className={`${iconButton} text-xs`}
                onClick={() => setPaused((p) => !p)}
              >
                <span aria-hidden>{paused ? "▶" : "❚❚"}</span>
              </button>
            </>
          )}
          <button
            type="button"
            aria-label="Dismiss"
            className={`${iconButton} text-base`}
            onClick={() => setDismissed(true)}
          >
            <span aria-hidden>✕</span>
          </button>
        </div>
      </section>

      <FormModal
        isOpen={listing}
        onOpenChange={setListing}
        title="Overdue Payments"
        size="2xl"
      >
        <p className="text-sm text-[#343A40]">
          <strong>Total overdue:</strong>{" "}
          {overdue.totals.map((total, i) => (
            <Fragment key={total.currency}>
              {i > 0 && " · "}
              <Money amount={total.amount} currency={total.currency} />
            </Fragment>
          ))}
          <span className="text-xs text-content-5"> (not under dispute)</span>
        </p>
        <ul className="flex flex-col gap-2">
          {shippers.map((shipper) => (
            <li
              key={keyOf(shipper)}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-gray-100 pb-2 text-sm text-[#343A40]"
            >
              <div className="min-w-0">
                <p className="font-semibold">{shipper.partyName}</p>
                <p className="text-content-5">
                  {plural(shipper.invoiceCount, "invoice")}, the oldest{" "}
                  {plural(shipper.oldestOverdueDays, "day")} past due
                </p>
              </div>
              <div className="flex items-center gap-3">
                <strong>
                  <Money amount={shipper.amount} currency={shipper.currency} />
                </strong>
                {canRecord && (
                  <button type="button" className={barButton} onClick={() => record(shipper)}>
                    Clear Payment
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </FormModal>

      {/* Mounted per shipper, so the form opens filled in for them. */}
      {recording && (
        <RecordPaymentModal
          isOpen
          onClose={() => setRecording(null)}
          shipper={{ id: recording.partyId, currency: recording.currency }}
        />
      )}
    </>
  );
}
